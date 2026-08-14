import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { getMonthGrid } from '@/lib/mock/calendar';

// Mirrors the month grid in ../NoBounds/NoBounds/Features/Timeline (CalendarSectionView): weekday header,
// week rows, today highlighted with a ring, legend for habit/reunion/important-date markers.
export function MonthCalendar() {
  const theme = useTheme();
  const today = new Date();
  const { weeks, weekdayLabels, monthLabel } = getMonthGrid(today);

  return (
    <View>
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

      <View style={styles.legend}>
        <LegendItem swatchColor={theme.accentMuted} label="All habits done" />
        <LegendItem swatchColor={theme.textSecondary} label="Reunion" />
        <LegendItem icon="heart" label="Important date" />
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
  monthLabel: { marginBottom: 8 },
  weekRow: { flexDirection: 'row' },
  cell: { flex: 1, textAlign: 'center', paddingVertical: 6 },
  dayCell: { alignItems: 'center', justifyContent: 'center' },
  todayText: { fontWeight: '700' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
});
