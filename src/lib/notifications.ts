import { supabase } from '@/lib/supabase';
import type { AppNotification, NotificationPreference } from '@/lib/database-types';

// note: the real backend's push_device_tokens table is apns-only (column is literally
// `apns_token`) — there's no fcm/android column, so registering an expo/android push token
// against this table isn't possible as-is. this file only covers the in-app notification
// inbox + per-type preferences, not push delivery.

export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as AppNotification[]) ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function fetchNotificationPreferences(): Promise<NotificationPreference[]> {
  const { data, error } = await supabase.from('notification_preferences').select('*');
  if (error) throw error;
  return (data as NotificationPreference[]) ?? [];
}

export async function setNotificationPreference(notificationType: string, enabled: boolean): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      { user_id: userId, notification_type: notificationType, enabled, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,notification_type' }
    );
  if (error) throw error;
}
