import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// a value + chevron-expand row that opens a modal picker list — mirrors how ios's unstyled
// Picker renders inside a Form (a value row that opens a menu), used in place of a segmented
// control for fields with more than two options or where ios's own source uses a plain Picker
export function DropdownField<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const currentLabel = options.find((o) => o.id === value)?.label ?? '';

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.row}>
        <ThemedText type="default">{label}</ThemedText>
        <View style={styles.value}>
          <ThemedText type="default" themeColor="textSecondary">
            {currentLabel}
          </ThemedText>
          <Ionicons name="chevron-expand" size={16} color={theme.textSecondary} />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.surfaceElevated }]}>
            <ThemedText type="smallBold" style={styles.title}>
              {label}
            </ThemedText>
            <ScrollView>
              {options.map((option) => {
                const selected = option.id === value;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      onChange(option.id);
                      setOpen(false);
                    }}
                    style={[styles.option, { borderColor: theme.border }]}>
                    <View style={styles.optionLabel}>
                      {option.icon ? (
                        <Ionicons name={option.icon} size={16} color={selected ? theme.accent : theme.textSecondary} />
                      ) : null}
                      <ThemedText type="default" style={selected ? { color: theme.accent, fontWeight: '600' } : undefined}>
                        {option.label}
                      </ThemedText>
                    </View>
                    {selected ? <Ionicons name="checkmark" size={18} color={theme.accent} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  value: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 32 },
  sheet: { borderRadius: 16, padding: 8, gap: 2, maxHeight: '70%' },
  title: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
