import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { fetchReunionDates, isReunionDay, subscribeReunionChanges } from '@/lib/reunion';

type DisplayMode = 'month' | 'week';

// "all habits done" cells use the palette's highlightSuccess tint (green) and reunion days use
// highlightReunion (blue), same tokens as ios's CalendarDayHighlight; reunion wins over all-done
const NO_REUNION: { startDate: string | null; endDate: string | null } = { startDate: null, endDate: null };

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
export const MonthCalendar = memo(function MonthCalendar() {
  const theme = useTheme();
  const { session, couple } = useSession();
  const today = new Date();
  const [mode, setMode] = useState<DisplayMode>('month');
  const [viewedDate, setViewedDate] = useState(today); // month/week currently on screen
  const [selectedDate, setSelectedDate] = useState(today); // tapped day
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [importantDates, setImportantDates] = useState<ImportantDate[]>([]);
  const [reunionState, setReunionState] = useState(NO_REUNION);

  const currentUserId = session?.user.id ?? null;
  const partnerId = couple?.partnerId ?? null;
  const coupleId = couple?.id ?? null;
  const viewedYear = viewedDate.getFullYear();
  const viewedMonth = viewedDate.getMonth();
  const reunion = coupleId ? reunionState : NO_REUNION;

  // paging months/weeks used to refetch everything from the network on every tap, and the day cells
  // each re-scanned every completion — that's what made stepping through months laggy. now a wide
  // window of completions is fetched once and only refetched when you page outside it.
  const loadedRangeRef = useRef<{ from: string; to: string } | null>(null);
  const habitsRef = useRef<Habit[]>([]);
  const requestRef = useRef(0);
  const viewedRef = useRef({ year: viewedYear, month: viewedMonth });
  useEffect(() => {
    viewedRef.current = { year: viewedYear, month: viewedMonth };
  }, [viewedYear, viewedMonth]);

  // full = also refetch habits + important dates (focus / after a toggle); otherwise only the
  // completions window is extended around the viewed month
  const load = useCallback(
    async (year: number, month: number, full: boolean) => {
      const request = ++requestRef.current;
      try {
        const from = new Date(year, month - 3, 1);
        const to = new Date(year, month + 4, 0);
        const habitRows = full || habitsRef.current.length === 0 ? await fetchHabits(coupleId) : habitsRef.current;
        const [completionRows, dateRows] = await Promise.all([
          fetchCompletionsInRange(
            habitRows.map((h) => h.id),
            dateKey(from),
            dateKey(to)
          ),
          full ? fetchImportantDates() : Promise.resolve(null),
        ]);
        if (request !== requestRef.current) return; // a newer load superseded this one
        habitsRef.current = habitRows;
        loadedRangeRef.current = { from: dateKey(from), to: dateKey(to) };
        setHabits(habitRows);
        setCompletions(completionRows);
        if (dateRows) setImportantDates(dateRows);
      } catch {
        // the calendar card is a summary — calendar's own screen shows the real error state.
      }
    },
    [coupleId]
  );

  // fresh habits/completions whenever the tab regains focus (e.g. back from the day sheet)
  useFocusEffect(
    useCallback(() => {
      load(viewedRef.current.year, viewedRef.current.month, true);
    }, [load])
  );

  // paging: only hit the network when the month (plus a month either side) isn't already loaded
  useEffect(() => {
    const range = loadedRangeRef.current;
    if (!range) return; // the focus load above does the first fetch
    const needFrom = dateKey(new Date(viewedYear, viewedMonth - 1, 1));
    const needTo = dateKey(new Date(viewedYear, viewedMonth + 2, 0));
    if (needFrom >= range.from && needTo <= range.to) return;
    load(viewedYear, viewedMonth, false);
  }, [viewedYear, viewedMonth, load]);

  // the reunion comes from the same couples.reunion_* the "Paired with" popover edits, and
  // refreshes the moment either editor saves
  useEffect(() => {
    if (!coupleId) return;
    let cancelled = false;
    const refresh = () => {
      fetchReunionDates(coupleId)
        .then((dates) => {
          if (!cancelled) setReunionState(dates);
        })
        .catch(() => {});
    };
    refresh();
    const unsubscribe = subscribeReunionChanges(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [coupleId]);

  // prebuilt lookups so each of the ~42 day cells is O(1) instead of scanning every date/completion
  const importantDateKeys = useMemo(() => {
    const yearly = new Set<string>();
    const exact = new Set<string>();
    for (const d of importantDates) {
      if (d.repeats_yearly) yearly.add(d.event_date.slice(5, 10));
      else exact.add(d.event_date.slice(0, 10));
    }
    return { yearly, exact };
  }, [importantDates]);

  const completionsByDate = useMemo(() => {
    const map = new Map<string, HabitCompletion[]>();
    for (const c of completions) {
      const list = map.get(c.completion_date);
      if (list) list.push(c);
      else map.set(c.completion_date, [c]);
    }
    return map;
  }, [completions]);

  function hasImportantDate(day: Date) {
    const key = dateKey(day);
    return importantDateKeys.exact.has(key) || importantDateKeys.yearly.has(key.slice(5));
  }

  // mirrors ios's CalendarViewModel.daySummary(for:) — satisfied vs total habits that apply
  // that day, resolved against both partners' completions (only that day's rows are scanned)
  const daySummary = useCallback(
    (day: Date) => {
      if (!currentUserId) return { satisfied: 0, total: 0 };
      const dayCompletions = completionsByDate.get(dateKey(day)) ?? [];
      const statuses = todaysDayStatuses(habits, dayCompletions, currentUserId, partnerId, day);
      return { satisfied: statuses.filter((s) => s.isSatisfied).length, total: statuses.length };
    },
    [habits, completionsByDate, currentUserId, partnerId]
  );

  // mirrors ios's CalendarViewModel.dayHighlight: reunion day beats all-habits-done
  function dayFill(day: Date, allDone: boolean): string | undefined {
    if (isReunionDay(dateKey(day), reunion.startDate, reunion.endDate)) return theme.highlightReunion;
    if (allDone) return theme.highlightSuccess;
    return undefined;
  }

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
    await load(viewedYear, viewedMonth, true);
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
        <ThemedText type="bodyBold">{mode === 'month' ? monthLabel : weekRangeLabel}</ThemedText>
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
              <ThemedText key={label} type="small" themeColor="textSecondary" style={[styles.cell, styles.weekdayLabel]}>
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
                const fill = dayDate ? dayFill(dayDate, allDone) : undefined;
                return (
                  <Pressable
                    key={dayIndex}
                    onPress={dayDate ? () => openDay(dayDate) : undefined}
                    disabled={!dayDate}
                    style={[
                      styles.cell,
                      styles.dayCell,
                      fill
                        ? { backgroundColor: fill }
                        : isSelected
                          ? { backgroundColor: theme.accent + '26' }
                          : isToday && { backgroundColor: theme.surfaceElevated },
                      isToday && { borderColor: theme.accent },
                    ]}>
                    <ThemedText type="small" style={[styles.dayNumber, isToday && styles.todayText]}>
                      {day ?? ''}
                    </ThemedText>
                    {summary.total > 0 ? (
                      <ThemedText
                        type="small"
                        themeColor={allDone ? 'accent' : 'textSecondary'}
                        style={styles.summaryText}>
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
              const fill = dayFill(day.fullDate, allDone);
              return (
                <Pressable key={day.fullDate.toISOString()} onPress={() => openDay(day.fullDate)}>
                  <View
                    style={[
                      styles.dayChip,
                      { borderColor: isToday ? theme.accent : theme.border, backgroundColor: theme.surface },
                      fill ? { backgroundColor: fill } : isSelected && { backgroundColor: theme.accent + '26' },
                    ]}>
                    <ThemedText type="small" themeColor={isSelected ? 'accent' : 'textSecondary'} style={styles.weekdayLabel}>
                      {day.weekdayLabel}
                    </ThemedText>
                    <ThemedText type="bodyBold" themeColor={isSelected ? 'accent' : undefined}>
                      {day.date}
                    </ThemedText>
                    {summary.total > 0 ? (
                      <ThemedText type="small" themeColor={isSelected ? 'accent' : 'textSecondary'} style={styles.chipSummary}>
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
          <LegendItem swatchColor={theme.highlightSuccess} label="All habits done" />
          <LegendItem swatchColor={theme.highlightReunion} label="Reunion" />
          <LegendItem icon="heart" label="Important date" />
        </View>
        <Pressable
          onPress={() => router.push('/habit-form')}
          style={[styles.addButton, { backgroundColor: theme.accent }]}>
          <Ionicons name="add" size={16} color={theme.surface} />
        </Pressable>
      </View>
    </View>
  );
});

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
      <ThemedText type="small" themeColor="textSecondary" style={styles.legendText}>
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
  // ios MonthCalendarGrid: 44pt min cell height, 8pt radius, 1pt today border
  dayCell: { alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  weekdayLabel: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  dayNumber: { fontSize: 14, lineHeight: 18 },
  summaryText: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  chipSummary: { fontSize: 11, lineHeight: 14 },
  legendText: { fontSize: 11, lineHeight: 14 },
  importantDateDot: { position: 'absolute', top: 2, right: 2 },
  chipImportantDateDot: { position: 'absolute', top: 4, right: 4 },
  todayText: { fontWeight: '700' },
  weekStrip: { gap: 8, paddingRight: 8 },
  dayChip: {
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: 10, // ios WeekStripView
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 56,
  },
  noHabitsText: { marginTop: 12 },
  selectedList: { marginTop: 12, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, flex: 1 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  addButton: { width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
