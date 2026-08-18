import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { fetchHabits, fetchTodaysCompletions, toggleHabitToday, type Habit, type HabitCompletion } from '@/lib/habits';

export default function CalendarScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [habitRows, completionRows] = await Promise.all([fetchHabits(), fetchTodaysCompletions()]);
      setHabits(habitRows);
      setCompletions(completionRows);
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

  async function onToggle(habit: Habit, currentlyDone: boolean) {
    setError(null);
    try {
      await toggleHabitToday(habit.id, !currentlyDone);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update habit');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.headingRow}>
          <ThemedText type="subtitle">Habits</ThemedText>
          <NBPrimaryButton title="Add habit" onPress={() => router.push('/habit-form')} />
        </View>

        {loading ? (
          <ThemedText type="default" themeColor="textSecondary">
            Loading…
          </ThemedText>
        ) : habits.length === 0 ? (
          <NBCard style={styles.centered}>
            <Ionicons name="checkmark-done-circle-outline" size={40} color={theme.accent} style={styles.icon} />
            <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
              No habits added yet. Tap Add habit to start tracking.
            </ThemedText>
          </NBCard>
        ) : (
          habits.map((habit) => {
            const myCompletion = completions.find(
              (c) => c.habit_id === habit.id && c.user_id === session?.user.id
            );
            const doneToday = myCompletion?.completed ?? false;
            return (
              <Pressable key={habit.id} onPress={() => onToggle(habit, doneToday)}>
                <NBCard style={styles.habitRow}>
                  <Ionicons
                    name={doneToday ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={doneToday ? theme.accent : theme.textSecondary}
                  />
                  <View style={styles.habitText}>
                    <ThemedText type="default">{habit.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {habit.owner_scope} · {habit.couple_id ? 'shared' : 'solo'}
                    </ThemedText>
                  </View>
                </NBCard>
              </Pressable>
            );
          })
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
