import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/form-header';
import { HabitRow } from '@/components/habit-row';
import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import {
  currentStreak,
  dateKey,
  fetchCompletionsInRange,
  fetchHabits,
  habitAppliesOn,
  resolveDayStatus,
  setHabitCompletion,
  type Habit,
  type HabitCompletion,
  type HabitDayStatus,
} from '@/lib/habits';
import type { ImportantDate } from '@/lib/database-types';
import { fetchImportantDates } from '@/lib/important-dates';
import { fetchTimelineFeed, timelineHeaderLine, type TimelineFeedItem } from '@/lib/timeline';

const STREAK_LOOKBACK_DAYS = 60;

const ACTIVITY_ICON: Record<TimelineFeedItem['item_type'], keyof typeof Ionicons.glyphMap> = {
  memory: 'book',
  gratitude: 'heart',
  photo: 'image',
  prompt: 'chatbubble-ellipses',
  milestone: 'flag',
};

// the calendar's day-detail sheet: tapping any date (month grid or week strip) opens this —
// mirrors ios's DayHabitsSheet exactly (important dates, that day's habits, that day's activity)
export default function DayHabitsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, couple } = useSession();
  const { date: dateParam } = useLocalSearchParams<{ date: string }>();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [importantDates, setImportantDates] = useState<ImportantDate[]>([]);
  const [activity, setActivity] = useState<TimelineFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);

  const selectedDate = useMemo(() => new Date(`${dateParam}T00:00:00`), [dateParam]);
  const formattedDate = useMemo(
    () => selectedDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    [selectedDate]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const habitRows = await fetchHabits();
      const from = new Date(selectedDate);
      from.setDate(from.getDate() - STREAK_LOOKBACK_DAYS);
      const [completionRows, dateRows] = await Promise.all([
        fetchCompletionsInRange(
          habitRows.map((h) => h.id),
          dateKey(from),
          dateParam
        ),
        fetchImportantDates(),
      ]);
      setHabits(habitRows);
      setCompletions(completionRows);
      setImportantDates(dateRows);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateParam]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setActivityLoading(true);
    fetchTimelineFeed({ filter: 'all', onDate: dateParam })
      .then(setActivity)
      .finally(() => setActivityLoading(false));
  }, [dateParam]);

  const currentUserId = session?.user.id ?? null;
  const partnerId = couple?.partnerId ?? null;

  const dayStatuses = useMemo<HabitDayStatus[]>(() => {
    if (!currentUserId) return [];
    return habits.filter((h) => habitAppliesOn(h, selectedDate)).map((h) => resolveDayStatus(h, dateParam, completions, currentUserId, partnerId));
  }, [habits, completions, currentUserId, partnerId, selectedDate, dateParam]);

  const dayImportantDates = importantDates.filter((d) => {
    const eventDate = new Date(`${d.event_date}T00:00:00`);
    if (d.repeats_yearly) {
      return eventDate.getMonth() === selectedDate.getMonth() && eventDate.getDate() === selectedDate.getDate();
    }
    return eventDate.getFullYear() === selectedDate.getFullYear() && eventDate.getMonth() === selectedDate.getMonth() && eventDate.getDate() === selectedDate.getDate();
  });

  async function onToggle(status: HabitDayStatus) {
    await setHabitCompletion(status.habit.id, status.dateKey, !status.myCompleted);
    await load();
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader title={formattedDate} rightLabel="Done" onRightPress={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        {dayImportantDates.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="title">Important dates</ThemedText>
            {dayImportantDates.map((d) => (
              <NBCard key={d.id} style={styles.row}>
                <Ionicons name="heart" size={20} color={theme.accent} style={styles.rowIcon} />
                <View style={styles.rowText}>
                  <ThemedText type="smallBold">{d.title}</ThemedText>
                  {d.description ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {d.description}
                    </ThemedText>
                  ) : null}
                </View>
              </NBCard>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText type="title">Habits</ThemedText>
          {loading ? (
            <ThemedText type="default" themeColor="textSecondary">
              Loading…
            </ThemedText>
          ) : dayStatuses.length === 0 ? (
            <NBCard style={styles.centered}>
              <Ionicons name="calendar" size={32} color={theme.accent} />
              <ThemedText type="small" themeColor="textSecondary">
                No habits for this day.
              </ThemedText>
            </NBCard>
          ) : (
            dayStatuses.map((status) => (
              <NBCard key={status.habit.id}>
                <HabitRow
                  status={status}
                  streak={currentUserId ? currentStreak(status.habit, completions, currentUserId, partnerId, selectedDate) : 0}
                  onToggle={onToggle}
                />
              </NBCard>
            ))
          )}
        </View>

        <View style={styles.section}>
          <ThemedText type="title">Activity</ThemedText>
          {activityLoading ? (
            <ThemedText type="default" themeColor="textSecondary">
              Loading…
            </ThemedText>
          ) : activity.length === 0 ? (
            <NBCard>
              <ThemedText type="small" themeColor="textSecondary">
                No activity on this day.
              </ThemedText>
            </NBCard>
          ) : (
            activity.map((item) => (
              <NBCard key={`${item.item_type}-${item.item_id}`} style={styles.row}>
                <Pressable
                  onPress={
                    item.item_type === 'photo'
                      ? () => router.push({ pathname: '/photo-detail', params: { photoId: item.entity_id } })
                      : undefined
                  }
                  disabled={item.item_type !== 'photo'}
                  style={styles.rowPressable}>
                  <Ionicons name={ACTIVITY_ICON[item.item_type]} size={20} color={theme.accent} style={styles.rowIcon} />
                  <View style={styles.rowText}>
                    <ThemedText type="default">{timelineHeaderLine(item)}</ThemedText>
                    {item.subtitle ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.subtitle}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              </NBCard>
            ))
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 24 },
  section: { gap: 12 },
  centered: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowPressable: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  rowIcon: { marginTop: 2 },
  rowText: { flex: 1, gap: 2 },
});
