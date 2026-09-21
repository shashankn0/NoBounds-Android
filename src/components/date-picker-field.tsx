import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { dateKey } from '@/lib/habits';
import { getMonthGrid } from '@/lib/mock/calendar';

// a label + date pill that expands an inline month grid, like ios's compact DatePicker inside a
// popover. pure js (no native date-picker module in this project), values are local yyyy-mm-dd.
export function DatePickerField({
  label,
  value,
  onChange,
  minDate,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  // yyyy-mm-dd — days before this are disabled (e.g. an end date can't precede the start)
  minDate?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selected = parse(value);
  const [viewed, setViewed] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const { weeks, weekdayLabels, monthLabel } = getMonthGrid(viewed);
  const todayKey = dateKey(new Date());

  function toggle() {
    if (!open) setViewed(new Date(selected.getFullYear(), selected.getMonth(), 1));
    setOpen((v) => !v);
  }

  function shiftMonth(delta: number) {
    setViewed((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <View>
      <View style={styles.row}>
        <ThemedText type="default">{label}</ThemedText>
        <Pressable onPress={toggle} style={[styles.pill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText type="default">{selected.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</ThemedText>
        </Pressable>
      </View>

      {open ? (
        <View style={styles.picker}>
          <View style={styles.monthRow}>
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={8}>
              <Ionicons name="chevron-back" size={18} color={theme.textPrimary} />
            </Pressable>
            <ThemedText type="bodyBold">{monthLabel}</ThemedText>
            <Pressable onPress={() => shiftMonth(1)} hitSlop={8}>
              <Ionicons name="chevron-forward" size={18} color={theme.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {weekdayLabels.map((w) => (
              <ThemedText key={w} type="small" themeColor="textSecondary" style={[styles.cell, styles.weekday]}>
                {w.slice(0, 1)}
              </ThemedText>
            ))}
          </View>

          {weeks.map((week, i) => (
            <View key={i} style={styles.weekRow}>
              {week.map((day, j) => {
                if (!day) return <View key={j} style={styles.cell} />;
                const key = dateKey(new Date(viewed.getFullYear(), viewed.getMonth(), day));
                const isSelected = key === value;
                const disabled = !!minDate && key < minDate;
                return (
                  <Pressable
                    key={j}
                    disabled={disabled}
                    onPress={() => {
                      onChange(key);
                      setOpen(false);
                    }}
                    style={[
                      styles.cell,
                      styles.day,
                      isSelected && { backgroundColor: theme.accent },
                      !isSelected && key === todayKey && { borderColor: theme.accent, borderWidth: 1 },
                    ]}>
                    <ThemedText
                      type="small"
                      style={[styles.dayText, isSelected && { color: theme.textOnAccent, fontWeight: '600' }, disabled && { opacity: 0.35 }]}>
                      {day}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function parse(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  // ios compact DatePicker pill
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  picker: { marginTop: 8, gap: 4 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 4 },
  weekRow: { flexDirection: 'row' },
  cell: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center' },
  weekday: { textAlign: 'center', lineHeight: 34, fontSize: 11, fontWeight: '600' },
  day: { borderRadius: 17 },
  dayText: { fontSize: 14, lineHeight: 18 },
});
