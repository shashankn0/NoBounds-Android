import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// a label + time pill that expands a scrollable list of half-hour times, in place of ios's
// DatePicker(displayedComponents: .hourAndMinute) — no native time-picker module in this
// project (same constraint as date-picker-field.tsx). value/onChange are 24h "HH:MM".
export function TimePickerField({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <View style={styles.row}>
        <ThemedText type="default">{label}</ThemedText>
        <Pressable onPress={() => setOpen((v) => !v)} style={[styles.pill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText type="default">{formatTime(value)}</ThemedText>
        </Pressable>
      </View>

      {open ? (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {HALF_HOURS.map((time) => {
            const selected = time === value;
            return (
              <Pressable
                key={time}
                onPress={() => {
                  onChange(time);
                  setOpen(false);
                }}
                style={[styles.option, selected && { backgroundColor: theme.accent + '1F' }]}>
                <ThemedText type="default" style={selected ? { color: theme.accent, fontWeight: '600' } : undefined}>
                  {formatTime(time)}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const HALF_HOURS: string[] = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minute}`;
});

function formatTime(value: string): string {
  const [hour24, minute] = value.split(':').map(Number);
  const period = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  list: { maxHeight: 200, marginTop: 8 },
  option: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
});
