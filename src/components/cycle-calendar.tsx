import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import {
  CYCLE_CALENDAR_MONTHS_BACK,
  CYCLE_CALENDAR_MONTHS_FORWARD,
  CYCLE_CALENDAR_WEEKDAY_SYMBOLS,
  buildCalendarDayStyler,
  cycleCalendarGridDays,
  cycleCalendarMonthStart,
  type CyclePhaseSnapshot,
} from '@/lib/cycle-tracking';
import type { CyclePeriodLog } from '@/lib/database-types';

// port of features/cycletracking/components/cyclecalendarview.swift
export function CycleCalendar({
  periodLogs,
  snapshot,
  showFlowDetails,
  onDayTap,
}: {
  periodLogs: CyclePeriodLog[];
  snapshot: CyclePhaseSnapshot;
  showFlowDetails: boolean;
  onDayTap?: (date: Date) => void;
}) {
  const theme = useTheme();
  const [monthOffset, setMonthOffset] = useState(0);

  const monthStart = useMemo(() => cycleCalendarMonthStart(monthOffset), [monthOffset]);
  const gridDays = useMemo(() => cycleCalendarGridDays(monthStart), [monthStart]);

  const rangeEnd = useMemo(() => {
    const lastMonthStart = cycleCalendarMonthStart(CYCLE_CALENDAR_MONTHS_FORWARD);
    return new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth() + 1, 0);
  }, []);

  const styler = useMemo(
    () => buildCalendarDayStyler(periodLogs, snapshot, rangeEnd, showFlowDetails),
    [periodLogs, snapshot, rangeEnd, showFlowDetails]
  );

  const monthLabel = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const today = new Date();

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold">Cycle calendar</ThemedText>

      <View style={styles.monthHeader}>
        <Pressable
          onPress={() => setMonthOffset((o) => o - 1)}
          disabled={monthOffset <= -CYCLE_CALENDAR_MONTHS_BACK}
          hitSlop={8}
          style={{ opacity: monthOffset <= -CYCLE_CALENDAR_MONTHS_BACK ? 0.3 : 1 }}>
          <Ionicons name="chevron-back" size={18} color={theme.accent} />
        </Pressable>
        <ThemedText type="smallBold" style={styles.monthLabel}>
          {monthLabel}
        </ThemedText>
        {monthOffset !== 0 ? (
          <Pressable onPress={() => setMonthOffset(0)} hitSlop={8}>
            <ThemedText type="small" themeColor="accent" style={styles.todayLink}>
              Today
            </ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => setMonthOffset((o) => o + 1)}
          disabled={monthOffset >= CYCLE_CALENDAR_MONTHS_FORWARD}
          hitSlop={8}
          style={{ opacity: monthOffset >= CYCLE_CALENDAR_MONTHS_FORWARD ? 0.3 : 1 }}>
          <Ionicons name="chevron-forward" size={18} color={theme.accent} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {CYCLE_CALENDAR_WEEKDAY_SYMBOLS.map((symbol, i) => (
          <View key={`weekday-${i}`} style={styles.cell}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.weekdayText}>
              {symbol}
            </ThemedText>
          </View>
        ))}

        {gridDays.map((date, i) => {
          if (!date) return <View key={`blank-${i}`} style={styles.cell} />;

          const isToday = date.toDateString() === today.toDateString();
          const isPeriod = styler.isPeriodDay(date);
          const isPredicted = !isPeriod && styler.isPredictedPeriodDay(date);
          const isFertile = !isPeriod && !isPredicted && styler.isFertileDay(date);

          const dayCell = (
            <View
              style={[
                styles.dayBox,
                { backgroundColor: dayBackground(theme.accent, theme.textSecondary, isPeriod, isPredicted, isFertile) },
                isPredicted && { borderWidth: 1, borderColor: theme.accent + '73', borderStyle: 'dashed' as const },
                isToday && { borderWidth: 1.5, borderColor: theme.accent },
              ]}>
              <ThemedText
                type={isToday ? 'smallBold' : 'small'}
                style={[styles.dayText, isToday && { color: theme.accent }]}>
                {date.getDate()}
              </ThemedText>
            </View>
          );

          return (
            <View key={date.toISOString()} style={styles.cell}>
              {onDayTap ? <Pressable onPress={() => onDayTap(date)}>{dayCell}</Pressable> : dayCell}
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        <LegendItem color={theme.accent + '40'} label="Period" />
        {styler.hasPredictions ? <LegendItem color={theme.accent + '1A'} label="Predicted" /> : null}
        <LegendItem color="#5FC98D40" label="Fertile window" />
      </View>
    </View>
  );
}

function dayBackground(accent: string, textSecondary: string, isPeriod: boolean, isPredicted: boolean, isFertile: boolean): string {
  if (isPeriod) return accent + '40';
  if (isPredicted) return accent + '1A';
  if (isFertile) return '#5FC98D40';
  // matches ios's appTheme.tokens.textSecondary.opacity(0.08) — palette-relative, not a fixed gray
  return textSecondary + '14';
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthLabel: { flex: 1, textAlign: 'center' },
  todayLink: { fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  weekdayText: { fontWeight: '600' },
  dayBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
});
