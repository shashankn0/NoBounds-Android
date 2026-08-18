import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton, NBSecondaryButton } from '@/components/nb-button';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { fetchHabits, fetchTodaysCompletions, toggleHabitToday, type Habit, type HabitCompletion } from '@/lib/habits';
import { mockDateIdeas } from '@/lib/mock/date-ideas';
import { mockGiftIdeas } from '@/lib/mock/gifts';
import { mockPet, petMoodEmoji } from '@/lib/mock/pet';
import { mockWeeklyShare } from '@/lib/mock/weekly-share';

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, couple } = useSession();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);

  const loadHabits = useCallback(async () => {
    try {
      const [habitRows, completionRows] = await Promise.all([fetchHabits(), fetchTodaysCompletions()]);
      setHabits(habitRows);
      setCompletions(completionRows);
    } catch {
      // Home's habit card is a summary — Calendar shows the real error state.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHabits();
    }, [loadHabits])
  );

  async function onToggle(habit: Habit, currentlyDone: boolean) {
    await toggleHabitToday(habit.id, !currentlyDone);
    await loadHabits();
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScreenHeader centerLabel={couple ? 'Paired with Partner 💛' : undefined} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + BottomTabInset }]}>
        {!couple ? (
          <NBCard>
            <ThemedText type="title">Invite your partner</ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
              Create a code to connect. You can keep using No Bounds while you wait.
            </ThemedText>
            <View style={styles.cardButton}>
              <NBPrimaryButton title="Set up pairing" onPress={() => router.push('/pairing')} />
            </View>
          </NBCard>
        ) : (
          <>
            <NBCard>
              <ThemedText type="title">Today&apos;s prompt</ThemedText>
              <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
                Answer today&apos;s question and reveal your partner&apos;s answer together.
              </ThemedText>
              <Pressable onPress={() => router.push('/prompt')}>
                <ThemedText type="link" themeColor="accent">
                  Open
                </ThemedText>
              </Pressable>
            </NBCard>

            <NBCard>
              <ThemedText type="title">Partner presence</ThemedText>
              <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
                Share what you&apos;re up to — your partner will see it in Bound.
              </ThemedText>
              <Pressable onPress={() => router.push('/photos')}>
                <ThemedText type="link" themeColor="accent">
                  Open
                </ThemedText>
              </Pressable>
            </NBCard>

            <NBCard>
              <ThemedText type="title">Your pet</ThemedText>
              <ThemedText type="default" style={styles.cardBody}>
                {petMoodEmoji[mockPet.mood]} {mockPet.name} · level {mockPet.level}
              </ThemedText>
              <Pressable onPress={() => router.push('/pet')}>
                <ThemedText type="link" themeColor="accent">
                  Visit
                </ThemedText>
              </Pressable>
            </NBCard>

            <NBCard>
              <ThemedText type="title">Weekly share</ThemedText>
              <ThemedText type="default" style={styles.cardBody}>
                {mockWeeklyShare.quote}
              </ThemedText>
              <Pressable onPress={() => router.push('/weekly-share')}>
                <ThemedText type="link" themeColor="accent">
                  Open
                </ThemedText>
              </Pressable>
            </NBCard>

            <NBCard>
              <ThemedText type="title">Date ideas</ThemedText>
              <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
                {mockDateIdeas.length} saved ideas, {mockDateIdeas.filter((i) => i.starred).length} starred
              </ThemedText>
              <Pressable onPress={() => router.push('/date-ideas')}>
                <ThemedText type="link" themeColor="accent">
                  Browse
                </ThemedText>
              </Pressable>
            </NBCard>

            <NBCard>
              <ThemedText type="title">Gift ideas</ThemedText>
              <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
                {mockGiftIdeas.length} saved ideas
              </ThemedText>
              <Pressable onPress={() => router.push('/gifts')}>
                <ThemedText type="link" themeColor="accent">
                  Browse
                </ThemedText>
              </Pressable>
            </NBCard>
          </>
        )}

        <NBCard>
          <View style={styles.rowBetween}>
            <ThemedText type="title">Today&apos;s habits</ThemedText>
            <Pressable onPress={() => router.push('/calendar')}>
              <ThemedText type="link" themeColor="accent">
                See all
              </ThemedText>
            </Pressable>
          </View>
          {habits.length === 0 ? (
            <ThemedText type="default" themeColor="textSecondary" style={styles.habitEmpty}>
              No habits added yet.
            </ThemedText>
          ) : (
            habits.slice(0, 3).map((habit) => {
              const doneToday =
                completions.find((c) => c.habit_id === habit.id && c.user_id === session?.user.id)?.completed ?? false;
              return (
                <Pressable key={habit.id} onPress={() => onToggle(habit, doneToday)} style={styles.habitRow}>
                  <Ionicons
                    name={doneToday ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={doneToday ? theme.accent : theme.textSecondary}
                  />
                  <ThemedText type="default" style={styles.habitLabel}>
                    {habit.title}
                  </ThemedText>
                </Pressable>
              );
            })
          )}
        </NBCard>

        <NBCard>
          <View style={styles.rowBetween}>
            <ThemedText type="title">Extensions</ThemedText>
            <Ionicons name="grid-outline" size={20} color={theme.textSecondary} />
          </View>
          <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
            Turn optional home cards on or off, and tell us what you&apos;d like next.
          </ThemedText>
          <View style={styles.cardButton}>
            <NBSecondaryButton title="Manage extensions" onPress={() => router.push('/extensions')} />
          </View>
        </NBCard>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  cardBody: { marginTop: 8, marginBottom: 4 },
  cardButton: { marginTop: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  habitEmpty: { marginTop: 10 },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  habitLabel: { flex: 1 },
});
