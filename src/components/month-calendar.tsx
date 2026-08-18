import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { fetchHabits, fetchTodaysCompletions, type Habit, type HabitCompletion } from '@/lib/habits';
import { getMonthGrid, getWeekDays } from '@/lib/mock/calendar';

type DisplayMode = 'month' | 'week';

// Mirrors CalendarSectionView in ../NoBounds/NoBounds/Features/Calendar: Month/Week toggle,
// weekday header + grid or a horizontal week strip, legend, and a "+" button for New habit /
// New important date (habit-form.tsx).
export function MonthCalendar() {
  const theme = useTheme();
  const { session } = useSession();
  const today = new Date();
  const [mode, setMode] = useState<DisplayMode>('month');
  const [selectedDate, setSelectedDate] = useState(today.getDate());
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);

  const loadHabits = useCallback(async () => {
    try {
      const [habitRows, completionRows] = await Promise.all([fetchHabits(), fetchTodaysCompletions()]);
      setHabits(habitRows);
      setCompletions(completionRows);
    } catch {
      // The calendar card is a summary — Calendar's own screen shows the real error state.
    }
  }, []);

  useEffect(() => {
    loadHabits();
  }, [loadHabits]);

  const { weeks, weekdayLabels, monthLabel } = getMonthGrid(today);
  const weekDays = getWeekDays(today);
  const todaysDoneCount = completions.filter((c) => c.completed && c.user_id === session?.user.id).length;

  return (
    <View>
      <View style={[styles.segmented, { backgroundColor: theme.backgroundSecondary }]}>
        {(['month', 'week'] as DisplayMode[]).map((id) => (
          <Pressable key={id} onPress={() => setMode(id)} style={styles.segmentWrap}>
            <View style={[styles.segment, mode === id && { backgroundColor: theme.surface }]}>
              <ThemedText type="smallBold">{id === 'month' ? 'Month' : 'Week'}</ThemedText>
            </View>
          </Pressable>
        ))}
      </View>

      {mode === 'month' ? (
        <>
          <ThemedText type="smallBold" style={styles.monthLabel}>
            {monthLabel}
          </ThemedText>
          <View style={styles.weekRow}>
            {weekdayLabels.map((label) => (
              <ThemedText key={label} type="small" themeColor="textSecondary" style={styles.cell}>
                {label}
              </ThemedText>
            ))}
          </View>
          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {week.map((day, dayIndex) => {
                const isToday = day === today.getDate();
                return (
                  <View
                    key={dayIndex}
                    style={[
                      styles.cell,
                      styles.dayCell,
                      isToday && { borderColor: theme.accent, borderWidth: 1.5, borderRadius: 8 },
                    ]}>
                    <ThemedText type="small" style={isToday ? styles.todayText : undefined}>
                      {day ?? ''}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          ))}
        </>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStrip}>
            {weekDays.map((day) => {
              const isToday = day.date === today.getDate();
              const isSelected = day.date === selectedDate;
              return (
                <Pressable key={day.date} onPress={() => setSelectedDate(day.date)}>
                  <View
                    style={[
                      styles.dayChip,
                      { borderColor: isToday ? theme.accent : theme.border },
                      isSelected && { backgroundColor: theme.accentMuted + '33' },
                    ]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {day.weekdayLabel}
                    </ThemedText>
                    <ThemedText type="smallBold">{day.date}</ThemedText>
                    {isToday && habits.length > 0 ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {todaysDoneCount}/{habits.length}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <ThemedText type="small" themeColor="textSecondary" style={styles.noHabitsText}>
            {selectedDate === today.getDate() && habits.length > 0
              ? `${habits.length} habit${habits.length === 1 ? '' : 's'} for this day.`
              : 'No habits for this day.'}
          </ThemedText>
        </>
      )}

      <View style={styles.legendRow}>
        <View style={styles.legend}>
          <LegendItem swatchColor={theme.accentMuted} label="All habits done" />
          <LegendItem swatchColor={theme.textSecondary} label="Reunion" />
          <LegendItem icon="heart" label="Important date" />
        </View>
        <Pressable
          onPress={() => router.push('/habit-form')}
          style={[styles.addButton, { backgroundColor: theme.accent }]}>
          <Ionicons name="add" size={18} color={theme.textOnAccent} />
        </Pressable>
      </View>
    </View>
  );
}

function LegendItem({
  swatchColor,
  icon,
  label,
}: {
  swatchColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.legendItem}>
      {swatchColor ? (
        <View style={[styles.legendSwatch, { backgroundColor: swatchColor }]} />
      ) : icon ? (
        <Ionicons name={icon} size={12} color={theme.accent} />
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 12 },
  segmentWrap: { flex: 1 },
  segment: { paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  monthLabel: { marginBottom: 8 },
  weekRow: { flexDirection: 'row' },
  cell: { flex: 1, textAlign: 'center', paddingVertical: 6 },
  dayCell: { alignItems: 'center', justifyContent: 'center' },
  todayText: { fontWeight: '700' },
  weekStrip: { gap: 8, paddingRight: 8 },
  dayChip: {
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 56,
  },
  noHabitsText: { marginTop: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, flex: 1 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  addButton: { width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
