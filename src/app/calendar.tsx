import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HabitRow } from '@/components/habit-row';
import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import {
  currentStreak,
  dateKey,
  fetchCompletionsInRange,
  fetchHabits,
  toggleHabitToday,
  todaysDayStatuses,
  type Habit,
  type HabitCompletion,
  type HabitDayStatus,
} from '@/lib/habits';
import type { ImportantDate } from '@/lib/database-types';
import { fetchImportantDates } from '@/lib/important-dates';

const STREAK_LOOKBACK_DAYS = 60;

// full habit list + toggle — the timeline tab's calendar card is a smaller summary of this
export default function CalendarScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, couple } = useSession();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [importantDates, setImportantDates] = useState<ImportantDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const habitRows = await fetchHabits();
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - STREAK_LOOKBACK_DAYS);
      const [completionRows, dateRows] = await Promise.all([
        fetchCompletionsInRange(
          habitRows.map((h) => h.id),
          dateKey(from),
          dateKey(to)
        ),
        fetchImportantDates(),
      ]);
      setHabits(habitRows);
      setCompletions(completionRows);
      setImportantDates(dateRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load habits');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const currentUserId = session?.user.id ?? null;
  const partnerId = couple?.partnerId ?? null;

  const habitStatuses = useMemo<HabitDayStatus[]>(() => {
    if (!currentUserId) return [];
    return todaysDayStatuses(habits, completions, currentUserId, partnerId);
  }, [habits, completions, currentUserId, partnerId]);

  async function onToggle(status: HabitDayStatus) {
    setError(null);
    try {
      await toggleHabitToday(status.habit.id, !status.myCompleted);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update habit');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.headingRow}>
          <ThemedText type="subtitle">Habits</ThemedText>
          <NBPrimaryButton title="Add habit" onPress={() => router.push('/habit-form')} />
        </View>

        {loading ? (
          <ThemedText type="default" themeColor="textSecondary">
            Loading…
          </ThemedText>
        ) : habitStatuses.length === 0 ? (
          <NBCard style={styles.centered}>
            <Ionicons name="checkmark-done-circle" size={40} color={theme.accent} style={styles.icon} />
            <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
              No habits added yet. Tap Add habit to start tracking.
            </ThemedText>
          </NBCard>
        ) : (
          habitStatuses.map((status) => (
            <NBCard key={status.habit.id}>
              <HabitRow
                status={status}
                streak={currentUserId ? currentStreak(status.habit, completions, currentUserId, partnerId) : 0}
                onToggle={onToggle}
              />
            </NBCard>
          ))
        )}

        <View style={styles.headingRow}>
          <ThemedText type="subtitle">Important dates</ThemedText>
          <NBPrimaryButton title="Add date" onPress={() => router.push('/habit-form')} />
        </View>

        {!loading && importantDates.length === 0 ? (
          <NBCard style={styles.centered}>
            <Ionicons name="heart" size={40} color={theme.accent} style={styles.icon} />
            <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
              No important dates yet.
            </ThemedText>
          </NBCard>
        ) : (
          importantDates.map((date) => (
            <NBCard key={date.id} style={styles.habitRow}>
              <Ionicons name="heart" size={22} color={theme.accent} />
              <View style={styles.habitText}>
                <ThemedText type="default">{date.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {new Date(date.event_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                  {date.repeats_yearly ? ' · every year' : ''}
                </ThemedText>
              </View>
            </NBCard>
          ))
        )}

        {error ? (
          <ThemedText type="small" themeColor="destructive">
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four },
  list: { gap: Spacing.three },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  centered: { alignItems: 'center', gap: 4 },
  centeredText: { textAlign: 'center' },
  icon: { marginBottom: 4 },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  habitText: { flex: 1, gap: 2 },
});
