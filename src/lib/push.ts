import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { routeForNotification } from '@/lib/notification-router';
import { supabase } from '@/lib/supabase';

// android push. the server side is public.android_push_tokens + the dispatch-push-android edge
// function (FCM HTTP v1); ios keeps using push_device_tokens/dispatch-push untouched.
const DEVICE_ID_KEY = 'nb.push.deviceId';
const CHANNEL_ID = 'default'; // must match android.notification.channel_id in dispatch-push-android

// show banners while the app is open too, like ios's foreground presentation
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// memoized so concurrent callers (registration + token-refresh listener) can't mint two ids
let deviceIdPromise: Promise<string> | null = null;
function getDeviceId(): Promise<string> {
  deviceIdPromise ??= loadOrCreateDeviceId();
  return deviceIdPromise;
}

async function loadOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
  } catch {
    // fall through and mint a new one
  }
  const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
  try {
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  } catch {
    // best-effort; a fresh id next launch just leaves one stale token row that FCM cleans up
  }
  return id;
}

async function saveToken(userId: string, fcmToken: string) {
  const deviceId = await getDeviceId();
  const { error } = await supabase
    .from('android_push_tokens')
    .upsert(
      { user_id: userId, device_id: deviceId, fcm_token: fcmToken, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,device_id' }
    );
  if (error) {
    console.warn('[push] could not save token', error.message);
    return;
  }
  // one physical device = one row: drop any stale rows holding this same token under another id
  await supabase.from('android_push_tokens').delete().eq('user_id', userId).eq('fcm_token', fcmToken).neq('device_id', deviceId);
}

// asks for permission, grabs the raw FCM token and stores it for this user. returns false when
// push can't be set up (emulator, denied permission, or the build has no firebase config)
export async function registerForPush(userId: string): Promise<boolean> {
  if (Platform.OS !== 'android' || !Device.isDevice) return false;

  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'NoBounds',
      importance: Notifications.AndroidImportance.MAX,
    });

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return false;

    const token = await Notifications.getDevicePushTokenAsync();
    if (typeof token.data !== 'string') return false;
    await saveToken(userId, token.data);
    return true;
  } catch (err) {
    console.warn('[push] registration failed', err);
    return false;
  }
}

// FCM can rotate the token at any time; keep the stored row current
export function watchPushTokenRefresh(userId: string): () => void {
  const sub = Notifications.addPushTokenListener((token) => {
    if (typeof token.data === 'string') saveToken(userId, token.data);
  });
  return () => sub.remove();
}

// call before signing out so the previous account stops getting pushes on this device
export async function unregisterPush(userId: string) {
  if (Platform.OS !== 'android') return;
  try {
    const deviceId = await getDeviceId();
    await supabase.from('android_push_tokens').delete().eq('user_id', userId).eq('device_id', deviceId);
  } catch {
    // best-effort
  }
}

function routeFromResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  const type = typeof data?.nb_type === 'string' ? data.nb_type : null;
  if (type) routeForNotification(type, data);
}

// taps on a system notification, both while running and when it cold-starts the app
export function watchNotificationTaps(): () => void {
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) routeFromResponse(response);
    })
    .catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(routeFromResponse);
  return () => sub.remove();
}
