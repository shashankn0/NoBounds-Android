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

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// Mirrors CalendarSectionView in ../NoBounds/NoBounds/Features/Calendar: Month/Week toggle,
// weekday header + grid or a horizontal week strip, legend, and a "+" button for New habit /
// New important date (habit-form.tsx). Prev/next arrows page the viewed month or week; a
// "Today" link jumps back when you've navigated away from the current one.
export function MonthCalendar() {
  const theme = useTheme();
  const { session } = useSession();
  const today = new Date();
  const [mode, setMode] = useState<DisplayMode>('month');
  const [viewedDate, setViewedDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
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

  function goToToday() {
    setViewedDate(today);
    setSelectedDate(today);
  }

  function shiftMonth(delta: number) {
    setViewedDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function shiftWeek(delta: number) {
    setViewedDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta * 7);
      return next;
    });
  }

  const { weeks, weekdayLabels, monthLabel } = getMonthGrid(viewedDate);
  const weekDays = getWeekDays(viewedDate);
  const weekRangeLabel = `${weekDays[0].fullDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekDays[6].fullDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  const todaysDoneCount = completions.filter((c) => c.completed && c.user_id === session?.user.id).length;
  const isViewingCurrentPeriod =
    mode === 'month' ? isSameMonth(viewedDate, today) : weekDays.some((d) => isSameDay(d.fullDate, today));

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

      <View style={styles.navRow}>
        <Pressable onPress={() => (mode === 'month' ? shiftMonth(-1) : shiftWeek(-1))} style={styles.navButton}>
          <Ionicons name="chevron-back" size={18} color={theme.textPrimary} />
        </Pressable>
        <ThemedText type="smallBold">{mode === 'month' ? monthLabel : weekRangeLabel}</ThemedText>
        <Pressable onPress={() => (mode === 'month' ? shiftMonth(1) : shiftWeek(1))} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={18} color={theme.textPrimary} />
        </Pressable>
      </View>
      {!isViewingCurrentPeriod ? (
        <Pressable onPress={goToToday}>
          <ThemedText type="link" themeColor="accent" style={styles.todayLink}>
            Today
          </ThemedText>
        </Pressable>
      ) : null}

      {mode === 'month' ? (
        <>
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
                const dayDate = day ? new Date(viewedDate.getFullYear(), viewedDate.getMonth(), day) : null;
                const isToday = dayDate ? isSameDay(dayDate, today) : false;
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
              const isToday = isSameDay(day.fullDate, today);
              const isSelected = isSameDay(day.fullDate, selectedDate);
              return (
                <Pressable key={day.fullDate.toISOString()} onPress={() => setSelectedDate(day.fullDate)}>
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
            {isSameDay(selectedDate, today) && habits.length > 0
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
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  navButton: { padding: 6 },
  todayLink: { marginBottom: 8 },
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
