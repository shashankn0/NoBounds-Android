import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { isTodoOverdue, todoColorHex, todoDueLabel, type TodoColor, type TodoItem } from '@/lib/todos';

type TodoItemRowProps = {
  item: TodoItem;
  subtaskProgress?: { completed: number; total: number };
  isEditable?: boolean;
  // shown when the task has no color of its own (subtasks inherit their parent's)
  inheritedColor?: TodoColor | null;
  onToggle: () => void;
  onPress?: () => void;
};

// port of features/todos/todoitemrowview.swift — completion toggle (tinted with the task's color
// tag), title, an optional notes preview, and due-date / subtask chips. the toggle is inert on
// the partner's (read-only) list.
export function TodoItemRow({ item, subtaskProgress, isEditable = true, inheritedColor = null, onToggle, onPress }: TodoItemRowProps) {
  const theme = useTheme();
  const tagColor = (item.color ?? inheritedColor) as TodoColor | null;
  const checkColor = tagColor ? todoColorHex(tagColor) : item.is_completed ? theme.accent : theme.textSecondary;

  const content = (
    <View style={styles.row}>
      <Pressable onPress={onToggle} disabled={!isEditable} hitSlop={8} accessibilityLabel={item.is_completed ? 'Mark as not done' : 'Complete task'}>
        <Ionicons name={item.is_completed ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={checkColor} />
      </Pressable>

      <View style={styles.text}>
        <ThemedText
          type="default"
          style={[
            styles.title,
            item.is_completed && [styles.completedTitle, { color: theme.textSecondary }],
          ]}>
          {item.title}
        </ThemedText>

        {item.notes ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {item.notes}
          </ThemedText>
        ) : null}

        {item.due || (subtaskProgress && subtaskProgress.total > 0) ? (
          <View style={styles.chipRow}>
            {item.due ? <DueChip item={item} due={item.due} /> : null}
            {subtaskProgress && subtaskProgress.total > 0 ? (
              <Chip
                text={`${subtaskProgress.completed}/${subtaskProgress.total}`}
                icon="list"
                color={theme.textSecondary}
                theme={theme}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }
  return content;
}

function DueChip({ item, due }: { item: TodoItem; due: NonNullable<TodoItem['due']> }) {
  const theme = useTheme();
  const overdue = isTodoOverdue(item);
  return (
    <Chip
      text={todoDueLabel(due)}
      icon={overdue ? 'alert-circle' : due.time ? 'time' : 'calendar'}
      color={overdue ? theme.destructive : theme.accent}
      theme={theme}
    />
  );
}

function Chip({ text, icon, color, theme }: { text: string; icon: keyof typeof Ionicons.glyphMap; color: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={[styles.chip, { backgroundColor: color + '1F' }]}>
      <Ionicons name={icon} size={11} color={color} />
      <ThemedText style={[styles.chipText, { color }]}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 6 },
  text: { flex: 1, gap: 3 },
  title: { fontWeight: '500' },
  completedTitle: { textDecorationLine: 'line-through' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
