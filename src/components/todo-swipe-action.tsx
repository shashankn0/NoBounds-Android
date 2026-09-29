import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

// a single full-height colored swipe action (delete on my rows, remind on the partner's) —
// shared between the list and the item-detail subtasks section
export function TodoSwipeAction({
  color,
  icon,
  label,
  onPress,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.action, { backgroundColor: color }]}>
      <Ionicons name={icon} size={18} color="#FFFFFF" />
      <ThemedText type="small" style={styles.text}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { width: 84, alignItems: 'center', justifyContent: 'center', gap: 2 },
  text: { color: '#FFFFFF', fontWeight: '600' },
});
