import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { HabitRow } from '@/components/habit-row';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import type { ImportantDate } from '@/lib/database-types';
import {
  currentStreak,
  dateKey,
  fetchCompletionsInRange,
  fetchHabits,
  setHabitCompletion,
  todaysDayStatuses,
  type Habit,
  type HabitCompletion,
  type HabitDayStatus,
} from '@/lib/habits';
import { fetchImportantDates } from '@/lib/important-dates';
import { getMonthGrid, getWeekDays } from '@/lib/mock/calendar';

type DisplayMode = 'month' | 'week';

// a green tint for "all habits done" day cells — ios pulls this from a per-palette
// highlightSuccessBackground token this app doesn't have yet, so a fixed accent-independent
// green stands in (same idea as ios: a color that reads as "done" regardless of palette)
const ALL_DONE_BACKGROUND = '#34C75926';
const ALL_DONE_TEXT = '#248A3D';

// same calendar day, ignoring time
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// same calendar month
function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// mirrors calendarsectionview in ../nobounds/nobounds/features/calendar: month/week toggle,
// weekday header + grid or a horizontal week strip, legend, and a "+" button for new habit /
// new important date (habit-form.tsx). prev/next arrows page the viewed month or week; a
// "today" link jumps back when you've navigated away from the current one.
export function MonthCalendar() {
  const theme = useTheme();
  const { session, couple } = useSession();
  const today = new Date();
  const [mode, setMode] = useState<DisplayMode>('month');
  const [viewedDate, setViewedDate] = useState(today); // month/week currently on screen
  const [selectedDate, setSelectedDate] = useState(today); // tapped day
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [importantDates, setImportantDates] = useState<ImportantDate[]>([]);

  const currentUserId = session?.user.id ?? null;
  const partnerId = couple?.partnerId ?? null;
  const viewedYear = viewedDate.getFullYear();
  const viewedMonth = viewedDate.getMonth();

  const load = useCallback(async () => {
    try {
      const habitRows = await fetchHabits();
      // covers the visible month plus a month on either side, so paging one step and streaks
      // ending on any visible day both have real data without refetching on every nav tap
      const from = new Date(viewedYear, viewedMonth - 2, 1);
      const to = new Date(viewedYear, viewedMonth + 2, 0);
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
    } catch {
      // the calendar card is a summary — calendar's own screen shows the real error state.
    }
  }, [viewedYear, viewedMonth]);

  useEffect(() => {
    load();
  }, [load]);

  // matches on month+day for yearly-repeating dates, exact date otherwise
  function hasImportantDate(day: Date) {
    return importantDates.some((d) => {
      const eventDate = new Date(`${d.event_date}T00:00:00`);
      if (d.repeats_yearly) {
        return eventDate.getMonth() === day.getMonth() && eventDate.getDate() === day.getDate();
      }
      return isSameDay(eventDate, day);
    });
  }

  // mirrors ios's CalendarViewModel.daySummary(for:) — satisfied vs total habits that apply
  // that day, resolved against both partners' completions
  const daySummary = useCallback(
    (day: Date) => {
      if (!currentUserId) return { satisfied: 0, total: 0 };
      const statuses = todaysDayStatuses(habits, completions, currentUserId, partnerId, day);
      return { satisfied: statuses.filter((s) => s.isSatisfied).length, total: statuses.length };
    },
    [habits, completions, currentUserId, partnerId]
  );

  // jump both viewed + selected date back to today
  function goToToday() {
    setViewedDate(today);
    setSelectedDate(today);
  }

  // mirrors ios's CalendarViewModel.selectDate: tapping any day (month grid or week strip)
  // opens that day's habits/important-dates/activity sheet
  function openDay(date: Date) {
    setSelectedDate(date);
    router.push({ pathname: '/day-habits', params: { date: dateKey(date) } });
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

  async function onToggleSelected(status: HabitDayStatus) {
    await setHabitCompletion(status.habit.id, status.dateKey, !status.myCompleted);
    await load();
  }

  const { weeks, weekdayLabels, monthLabel } = getMonthGrid(viewedDate);
  const weekDays = getWeekDays(viewedDate);
  const weekRangeLabel = `${weekDays[0].fullDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekDays[6].fullDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  const isViewingCurrentPeriod =
    mode === 'month' ? isSameMonth(viewedDate, today) : weekDays.some((d) => isSameDay(d.fullDate, today));

  // the inline habit list under the week strip — mirrors ios's WeekStripView, which shows the
  // selected day's habits directly on the page (separate from the day-detail sheet a tap opens)
  const selectedStatuses = useMemo(
    () => (currentUserId ? todaysDayStatuses(habits, completions, currentUserId, partnerId, selectedDate) : []),
    [habits, completions, currentUserId, partnerId, selectedDate]
  );

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
        // full grid: weekday header row + one row per week
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
                const isSelected = dayDate ? isSameDay(dayDate, selectedDate) : false;
                const dayHasImportantDate = dayDate ? hasImportantDate(dayDate) : false;
                const summary = dayDate ? daySummary(dayDate) : { satisfied: 0, total: 0 };
                const allDone = summary.total > 0 && summary.satisfied === summary.total;
                return (
                  <Pressable
                    key={dayIndex}
                    onPress={dayDate ? () => openDay(dayDate) : undefined}
                    disabled={!dayDate}
                    style={[
                      styles.cell,
                      styles.dayCell,
                      allDone && { backgroundColor: ALL_DONE_BACKGROUND },
                      !allDone && isSelected && { backgroundColor: theme.accent + '26' },
                      isToday && { borderColor: theme.accent, borderWidth: 1.5 },
                    ]}>
                    <ThemedText type="small" style={isToday ? styles.todayText : undefined}>
                      {day ?? ''}
                    </ThemedText>
                    {summary.total > 0 ? (
                      <ThemedText
                        type="small"
                        themeColor={allDone ? undefined : 'textSecondary'}
                        style={[styles.summaryText, allDone && { color: ALL_DONE_TEXT }]}>
                        {summary.satisfied}/{summary.total}
                      </ThemedText>
                    ) : null}
                    {dayHasImportantDate ? (
                      <Ionicons name="heart" size={8} color={theme.accent} style={styles.importantDateDot} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </>
      ) : (
        // scrollable strip of day chips, plus the selected day's habits inline below
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStrip}>
            {weekDays.map((day) => {
              const isToday = isSameDay(day.fullDate, today);
              const isSelected = isSameDay(day.fullDate, selectedDate);
              const dayHasImportantDate = hasImportantDate(day.fullDate);
              const summary = daySummary(day.fullDate);
              const allDone = summary.total > 0 && summary.satisfied === summary.total;
              return (
                <Pressable key={day.fullDate.toISOString()} onPress={() => openDay(day.fullDate)}>
                  <View
                    style={[
                      styles.dayChip,
                      { borderColor: isToday ? theme.accent : theme.border, backgroundColor: theme.surface },
                      allDone && { backgroundColor: ALL_DONE_BACKGROUND },
                      !allDone && isSelected && { backgroundColor: theme.accent + '26' },
                    ]}>
                    <ThemedText type="small" themeColor={isSelected ? 'accent' : 'textSecondary'}>
                      {day.weekdayLabel}
                    </ThemedText>
                    <ThemedText type="smallBold" themeColor={isSelected ? 'accent' : undefined}>
                      {day.date}
                    </ThemedText>
                    {summary.total > 0 ? (
                      <ThemedText type="small" themeColor={isSelected ? 'accent' : 'textSecondary'}>
                        {summary.satisfied}/{summary.total}
                      </ThemedText>
                    ) : null}
                    {dayHasImportantDate ? (
                      <Ionicons name="heart" size={8} color={theme.accent} style={styles.chipImportantDateDot} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedStatuses.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.noHabitsText}>
              No habits for this day.
            </ThemedText>
          ) : (
            <View style={styles.selectedList}>
              {selectedStatuses.map((status) => (
                <HabitRow
                  key={status.habit.id}
                  status={status}
                  streak={currentUserId ? currentStreak(status.habit, completions, currentUserId, partnerId, selectedDate) : 0}
                  onToggle={onToggleSelected}
                />
              ))}
            </View>
          )}
        </>
      )}

      <View style={styles.legendRow}>
        <View style={styles.legend}>
          <LegendItem swatchColor={ALL_DONE_BACKGROUND.slice(0, 7)} label="All habits done" />
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
  dayCell: { alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1.5, borderColor: 'transparent' },
  summaryText: { fontSize: 11 },
  importantDateDot: { position: 'absolute', top: 2, right: 2 },
  chipImportantDateDot: { position: 'absolute', top: 4, right: 4 },
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
  selectedList: { marginTop: 12, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, flex: 1 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  addButton: { width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
