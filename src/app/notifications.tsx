import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { AppNotification } from '@/lib/database-types';
import { fetchNotifications, markNotificationRead } from '@/lib/notifications';

export default function NotificationsScreen() {
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
    if (notification.read_at) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    try {
      await markNotificationRead(notification.id);
    } catch {
      // best-effort — worst case it just shows as unread again next load
    }
  }

  return (
    <ThemedView style={styles.container}>
      {loading ? (
        <ThemedText type="default" themeColor="textSecondary">
          Loading…
        </ThemedText>
      ) : notifications.length === 0 ? (
        <ThemedText type="default" themeColor="textSecondary">
          Nothing yet — you&apos;ll see prompt replies, reactions, and reminders here.
        </ThemedText>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          renderItem={({ item }) => (
            <Pressable onPress={() => onOpen(item)}>
              <NBCard elevated={!item.read_at}>
                <ThemedText type="smallBold">{item.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
                  {item.body}
                </ThemedText>
              </NBCard>
            </Pressable>
          )}
        />
      )}
      {error ? (
        <ThemedText type="small" themeColor="destructive">
          {error}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four },
  list: { gap: Spacing.three },
  body: { marginTop: 4 },
});
