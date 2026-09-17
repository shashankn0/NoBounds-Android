import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { todayKey, type HabitDayStatus, type HabitOwnerScope } from '@/lib/habits';

type HabitRowProps = {
  status: HabitDayStatus;
  streak: number;
  onToggle: (status: HabitDayStatus) => void;
};

const SCOPE_LABEL: Record<HabitOwnerScope, string> = {
  mine: 'Mine',
  yours: "Partner's",
  ours: 'Ours',
};

// mirrors ios's HabitRowView: distinct icon + tap behavior per habit_kind (system habits like
// bound_streak complete via their linked flow — the Bound camera — never a plain checkbox tap),
// plus a streak badge and an owner-scope chip on every row.
export function HabitRow({ status, streak, onToggle }: HabitRowProps) {
  const theme = useTheme();
  const { habit } = status;

  const onPress = rowAction(status, onToggle);
  const icon = rowIcon(status, theme);

  const content = (
    <View style={styles.row}>
      <Ionicons name={icon.name} size={24} color={icon.color} style={styles.icon} />

      <View style={styles.text}>
        <ThemedText type="smallBold">{habit.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {status.statusLabel}
        </ThemedText>
      </View>

      {streak > 0 ? (
        <ThemedText type="small" themeColor="accent" style={styles.streak}>
          {habit.habit_kind === 'bound_streak'
            ? `🔥 ${streak}`
            : habit.habit_kind === 'weeks_bound'
              ? `${streak} wk`
              : `🔥 ${streak}`}
        </ThemedText>
      ) : null}

      <View style={[styles.scopeChip, { backgroundColor: theme.accent + '1f' }]}>
        <ThemedText type="small" themeColor="accent" style={styles.scopeChipText}>
          {SCOPE_LABEL[habit.owner_scope]}
        </ThemedText>
      </View>
    </View>
  );

  if (!onPress) {
    return <View style={styles.disabledRow}>{content}</View>;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

// tap opens the Bound camera for an unsent bound_streak, toggles a normal checkbox habit, or
// does nothing for a habit the current user can't act on right now (weeks_bound, or a habit
// scoped to the partner / already satisfied)
function rowAction(status: HabitDayStatus, onToggle: (status: HabitDayStatus) => void): (() => void) | null {
  if (status.habit.habit_kind === 'bound_streak') {
    if (!status.myCompleted && status.dateKey === todayKey()) {
      return () => router.push('/photos');
    }
    return null;
  }
  if (status.habit.habit_kind === 'weeks_bound') {
    return null;
  }
  if (status.canToggle) {
    return () => onToggle(status);
  }
  return null;
}

function rowIcon(status: HabitDayStatus, theme: ReturnType<typeof useTheme>): { name: keyof typeof Ionicons.glyphMap; color: string } {
  const { habit, isSatisfied, isPartiallyComplete, myCompleted, canToggle } = status;

  if (habit.habit_kind === 'weeks_bound') {
    return { name: isSatisfied ? 'checkmark-circle' : 'images', color: theme.accent };
  }

  if (habit.habit_kind === 'bound_streak') {
    if (myCompleted) {
      return { name: isSatisfied ? 'checkmark-circle' : 'contrast', color: theme.accent };
    }
    return { name: 'camera', color: theme.accent };
  }

  const name = isSatisfied ? 'checkmark-circle' : isPartiallyComplete ? 'contrast' : 'ellipse-outline';
  if (canToggle) {
    return { name, color: isSatisfied || isPartiallyComplete ? theme.accent : theme.textSecondary };
  }
  return { name, color: isSatisfied || isPartiallyComplete ? theme.accent : theme.border };
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  disabledRow: { opacity: 1 },
  pressed: { opacity: 0.6 },
  icon: { flexShrink: 0 },
  text: { flex: 1, gap: 2 },
  streak: { flexShrink: 0 },
  scopeChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, flexShrink: 0 },
  scopeChipText: { fontWeight: '600' },
});
