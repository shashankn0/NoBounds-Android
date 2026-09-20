import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import type { AppNotification } from '@/lib/database-types';
import { routeForNotification } from '@/lib/notification-router';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/notifications';

// port of features/notifications/notificationcenterview.swift + notificationrowview.swift
const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  presence_new_photo: 'images',
  reaction_photo: 'images',
  prompt_unanswered: 'chatbubble-ellipses',
  reaction_prompt: 'chatbubble-ellipses',
  habit_reminder: 'calendar',
  habit_missed_digest: 'calendar',
  milestone: 'heart',
  reunion_countdown: 'heart',
  cycle_heads_up: 'calendar',
  cycle_symptom_sos: 'warning',
  pet_activity: 'paw',
};
const DEFAULT_ICON: keyof typeof Ionicons.glyphMap = 'notifications';

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setNotifications(await fetchNotifications());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onOpen(notification: AppNotification) {
    routeForNotification(notification.notification_type, notification.payload as Record<string, unknown>);
    if (notification.read_at) return;
    setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n)));
    try {
      await markNotificationRead(notification.id);
    } catch {
      // best-effort — worst case it just shows as unread again next load
    }
  }

  async function onMarkAllRead() {
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    try {
      await markAllNotificationsRead();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark all as read');
      await load();
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader
        title="Notifications"
        leftLabel="Done"
        onLeftPress={() => router.back()}
        rightLabel={!loading && notifications.length > 0 ? 'Mark all read' : undefined}
        onRightPress={onMarkAllRead}
      />
      {loading ? (
        <ThemedText type="default" themeColor="textSecondary" style={styles.centerPad}>
          Loading…
        </ThemedText>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off" size={36} color={theme.accent} />
          <ThemedText type="subtitle">You&apos;re all caught up</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            Supportive updates from your partner will show up here.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          renderItem={({ item }) => (
            <Pressable onPress={() => onOpen(item)}>
              <NBCard>
                <View style={styles.row}>
                  <Ionicons name={TYPE_ICON[item.notification_type] ?? DEFAULT_ICON} size={22} color={theme.accent} style={styles.icon} />
                  <View style={styles.textCol}>
                    <View style={styles.titleRow}>
                      <ThemedText type={item.read_at ? 'default' : 'smallBold'} style={styles.title}>
                        {item.title}
                      </ThemedText>
                      {!item.read_at ? <View style={[styles.unreadDot, { backgroundColor: theme.accent }]} /> : null}
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.body}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.timestamp}>
                      {relativeTime(item.created_at)}
                    </ThemedText>
                  </View>
                </View>
              </NBCard>
            </Pressable>
          )}
        />
      )}
      {error ? (
        <ThemedText type="small" themeColor="destructive" style={styles.centerPad}>
          {error}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centerPad: { padding: 20 },
  centeredText: { textAlign: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  list: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: { marginTop: 2 },
  textCol: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  timestamp: { marginTop: 2 },
});
