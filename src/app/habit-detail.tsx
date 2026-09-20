import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/form-header';
import { HabitRow } from '@/components/habit-row';
import { NBCard } from '@/components/nb-card';
import { NBSecondaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import {
  archiveHabit,
  currentStreak,
  dateKey,
  fetchCompletionsInRange,
  fetchHabits,
  habitAppliesOn,
  resolveDayStatus,
  setHabitCompletion,
  type Habit,
  type HabitCompletion,
  type HabitCompletionPolicy,
  type HabitDayStatus,
  type HabitOwnerScope,
} from '@/lib/habits';

const RECENT_HISTORY_DAYS = 14;

const SCOPE_LABEL: Record<HabitOwnerScope, string> = { mine: 'Mine', yours: "Partner's", ours: 'Ours' };
const POLICY_LABEL: Record<HabitCompletionPolicy, string> = { either: 'Either partner', both: 'Both required' };

// port of features/calendar/habitdetailview.swift — a single habit's status, today's row, and
// a 14-day recent-history strip, reached by tapping a habit reminder notification
export default function HabitDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, couple } = useSession();
  const { habitId } = useLocalSearchParams<{ habitId: string }>();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const habitRows = await fetchHabits();
      const from = new Date();
      from.setDate(from.getDate() - RECENT_HISTORY_DAYS);
      const completionRows = await fetchCompletionsInRange(habitRows.map((h) => h.id), dateKey(from), dateKey(new Date()));
      setHabits(habitRows);
      setCompletions(completionRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load habit');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const habit = habits.find((h) => h.id === habitId) ?? null;
  const currentUserId = session?.user.id ?? null;
  const partnerId = couple?.partnerId ?? null;
  const today = useMemo(() => new Date(), []);
  const todayKeyStr = dateKey(today);

  const todayStatus = habit && currentUserId ? resolveDayStatus(habit, todayKeyStr, completions, currentUserId, partnerId) : null;
  const streak = habit && currentUserId ? currentStreak(habit, completions, currentUserId, partnerId, today) : 0;

  const recentStatuses = useMemo(() => {
    if (!habit || !currentUserId) return [];
    const entries: { date: Date; status: HabitDayStatus }[] = [];
    for (let offset = 0; offset < RECENT_HISTORY_DAYS; offset++) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      if (!habitAppliesOn(habit, date)) continue;
      entries.push({ date, status: resolveDayStatus(habit, dateKey(date), completions, currentUserId, partnerId) });
    }
    return entries;
  }, [habit, completions, currentUserId, partnerId]);

  async function onToggleToday(status: HabitDayStatus) {
    await setHabitCompletion(status.habit.id, status.dateKey, !status.myCompleted);
    await load();
  }

  function onEdit() {
    if (!habit) return;
    router.push({
      pathname: '/habit-form',
      params: { habitId: habit.id, initialTitle: habit.title, initialScope: habit.owner_scope, initialPolicy: habit.completion_policy },
    });
  }

  function onDelete() {
    if (!habit) return;
    Alert.alert('Delete habit?', 'This habit will be removed from your calendar. Past completions are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await archiveHabit(habit.id);
            router.back();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete habit');
            setDeleting(false);
          }
        },
      },
    ]);
  }

  const canManage = habit?.habit_kind === 'standard';

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader title="Habit" leftIcon="chevron-back" onLeftPress={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        {loading ? (
          <ThemedText type="default" themeColor="textSecondary">
            Loading…
          </ThemedText>
        ) : !habit || !todayStatus ? (
          <ThemedText type="default" themeColor="textSecondary">
            That habit couldn&apos;t be found.
          </ThemedText>
        ) : (
          <>
            <NBCard>
              <View style={styles.titleRow}>
                <ThemedText type="subtitle" style={styles.titleText}>
                  {habit.title}
                </ThemedText>
                {streak > 0 ? (
                  <ThemedText type="small" themeColor="accent" style={styles.streakBadge}>
                    🔥 {streak} day streak
                  </ThemedText>
                ) : null}
              </View>
              <View style={styles.chipRow}>
                <Chip label={SCOPE_LABEL[habit.owner_scope]} theme={theme} />
                {habit.owner_scope === 'ours' ? <Chip label={POLICY_LABEL[habit.completion_policy]} theme={theme} /> : null}
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
                {todayStatus.statusLabel}
              </ThemedText>
            </NBCard>

            <NBCard>
              <ThemedText type="subtitle" style={styles.sectionLabel}>
                {today.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </ThemedText>
              <HabitRow status={todayStatus} streak={0} onToggle={onToggleToday} />
            </NBCard>

            {recentStatuses.length > 0 ? (
              <NBCard>
                <ThemedText type="subtitle" style={styles.sectionLabel}>
                  Recent history
                </ThemedText>
                {recentStatuses.map(({ date, status }) => (
                  <View key={dateKey(date)} style={styles.historyRow}>
                    <ThemedText type="default" themeColor="textSecondary">
                      {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </ThemedText>
                    <Ionicons
                      name={status.isSatisfied ? 'checkmark-circle' : status.isPartiallyComplete ? 'contrast' : 'ellipse-outline'}
                      size={20}
                      color={status.isSatisfied || status.isPartiallyComplete ? theme.accent : theme.border}
                    />
                  </View>
                ))}
              </NBCard>
            ) : null}

            {canManage ? (
              <View style={styles.manageButtons}>
                <View style={styles.manageButton}>
                  <NBSecondaryButton title="Edit" onPress={onEdit} disabled={deleting} />
                </View>
                <View style={styles.manageButton}>
                  <NBSecondaryButton title={deleting ? 'Deleting…' : 'Delete'} onPress={onDelete} disabled={deleting} />
                </View>
              </View>
            ) : null}
          </>
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

function Chip({ label, theme }: { label: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={[styles.chip, { backgroundColor: theme.accent + '1f' }]}>
      <ThemedText type="small" themeColor="accent" style={styles.chipText}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titleText: { flex: 1 },
  streakBadge: { fontWeight: '600' },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontWeight: '600' },
  body: { marginTop: 10 },
  sectionLabel: { marginBottom: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  manageButtons: { flexDirection: 'row', gap: 12 },
  manageButton: { flex: 1 },
});
