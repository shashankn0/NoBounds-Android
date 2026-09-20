import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// port of features/prompt/components/promptdateseparatorview.swift
export function PromptDateSeparator({ dateOnly }: { dateOnly: string }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={[styles.pill, { backgroundColor: theme.surfaceElevated }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
          {label(dateOnly)}
        </ThemedText>
      </View>
    </View>
  );
}

function label(dateOnly: string): string {
  const date = new Date(`${dateOnly}T00:00:00`);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', paddingVertical: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  label: { fontWeight: '600' },
});
