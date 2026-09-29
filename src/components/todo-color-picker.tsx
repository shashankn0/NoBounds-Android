import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { TODO_COLORS, todoColorHex, todoColorLabel, type TodoColor } from '@/lib/todos';

// port of features/todos/todocolorpicker.swift's TodoColorPicker — a swatch row for tagging a
// task with a color; the first (crossed-out) swatch clears it
export function TodoColorPicker({ selection, onChange }: { selection: TodoColor | null; onChange: (color: TodoColor | null) => void }) {
  const theme = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Swatch color={null} isSelected={selection === null} onPress={() => onChange(null)} theme={theme} />
      {TODO_COLORS.map((color) => (
        <Swatch key={color} color={color} isSelected={selection === color} onPress={() => onChange(color)} theme={theme} />
      ))}
    </ScrollView>
  );
}

function Swatch({
  color,
  isSelected,
  onPress,
  theme,
}: {
  color: TodoColor | null;
  isSelected: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={color ? todoColorLabel(color) : 'No color'}
      style={[styles.ring, isSelected && { borderColor: theme.textPrimary }]}>
      <View
        style={[
          styles.swatch,
          { backgroundColor: color ? todoColorHex(color) : theme.surfaceElevated },
          !color && { borderWidth: 1, borderColor: theme.border },
        ]}>
        {!color ? (
          <Ionicons name="close" size={13} color={theme.textSecondary} />
        ) : isSelected ? (
          <Ionicons name="checkmark" size={13} color="#FFFFFF" />
        ) : null}
      </View>
    </Pressable>
  );
}

// port of features/todos/todocolorpicker.swift's TodoColorLabel — read-only dot + name, used for
// the partner's tasks
export function TodoColorLabel({ color }: { color: TodoColor | null }) {
  if (!color) {
    return (
      <ThemedText type="default" themeColor="textSecondary">
        No color
      </ThemedText>
    );
  }
  return (
    <View style={styles.labelRow}>
      <View style={[styles.dot, { backgroundColor: todoColorHex(color) }]} />
      <ThemedText type="default">{todoColorLabel(color)}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, paddingVertical: 6, paddingHorizontal: 4 },
  ring: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
