import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { TODO_SORT_OPTIONS, type TodoSortOption } from '@/lib/todos';

// port of features/todos/todolistoptionsmenu.swift's "…" toolbar menu: sort order (a submenu,
// collapsed until tapped — mirrors ios's nested Picker(.menu) rather than listing every option
// up front), show/hide completed, calendar sync, and (on my own list) clearing completed tasks.
// rows use the app's accent color, same as ios's rows inheriting the root .tint(accent).
export function TodoOptionsMenu({
  sortOption,
  onChangeSort,
  showCompleted,
  onToggleShowCompleted,
  canClearCompleted,
  onClearCompleted,
}: {
  sortOption: TodoSortOption;
  onChangeSort: (option: TodoSortOption) => void;
  showCompleted: boolean;
  onToggleShowCompleted: () => void;
  canClearCompleted: boolean;
  onClearCompleted: () => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [sortExpanded, setSortExpanded] = useState(false);

  function close() {
    setOpen(false);
    setSortExpanded(false);
  }

  const currentSortTitle = TODO_SORT_OPTIONS.find((o) => o.id === sortOption)?.title ?? 'Manual';

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityLabel="More options">
        <Ionicons name="ellipsis-horizontal-circle-outline" size={24} color={theme.accent} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.surfaceElevated }]}>
            <Pressable onPress={() => setSortExpanded((v) => !v)} style={styles.row}>
              <View style={styles.rowLabel}>
                <Ionicons name="swap-vertical" size={16} color={theme.accent} />
                <ThemedText type="default" style={{ color: theme.accent }}>
                  Sort by
                </ThemedText>
              </View>
              <View style={styles.rowLabel}>
                <ThemedText type="small" themeColor="textSecondary">
                  {currentSortTitle}
                </ThemedText>
                <Ionicons name={sortExpanded ? 'chevron-up' : 'chevron-forward'} size={14} color={theme.textSecondary} />
              </View>
            </Pressable>

            {sortExpanded
              ? TODO_SORT_OPTIONS.map((option) => {
                  const selected = option.id === sortOption;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => {
                        onChangeSort(option.id);
                        close();
                      }}
                      style={[styles.row, styles.subRow]}>
                      <View style={styles.rowLabel}>
                        <Ionicons name={option.icon as keyof typeof Ionicons.glyphMap} size={15} color={selected ? theme.accent : theme.textSecondary} />
                        <ThemedText type="default" style={selected ? { color: theme.accent, fontWeight: '600' } : undefined}>
                          {option.title}
                        </ThemedText>
                      </View>
                      {selected ? <Ionicons name="checkmark" size={18} color={theme.accent} /> : null}
                    </Pressable>
                  );
                })
              : null}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <Pressable
              onPress={() => {
                onToggleShowCompleted();
                close();
              }}
              style={styles.row}>
              <View style={styles.rowLabel}>
                <Ionicons name={showCompleted ? 'eye-off' : 'eye'} size={16} color={theme.accent} />
                <ThemedText type="default" style={{ color: theme.accent }}>
                  {showCompleted ? 'Hide completed' : 'Show completed'}
                </ThemedText>
              </View>
            </Pressable>

            <Pressable
              onPress={() => {
                close();
                Alert.alert('Calendar sync', "Calendar sync isn't available on Android yet — it's coming in a future update.");
              }}
              style={styles.row}>
              <View style={styles.rowLabel}>
                <Ionicons name="calendar-outline" size={16} color={theme.accent} />
                <ThemedText type="default" style={{ color: theme.accent }}>
                  Calendar sync…
                </ThemedText>
              </View>
            </Pressable>

            {canClearCompleted ? (
              <Pressable
                onPress={() => {
                  onClearCompleted();
                  close();
                }}
                style={styles.row}>
                <View style={styles.rowLabel}>
                  <Ionicons name="trash" size={16} color={theme.destructive} />
                  <ThemedText type="default" themeColor="destructive">
                    Clear completed
                  </ThemedText>
                </View>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'flex-end', padding: 16, paddingTop: 56 },
  sheet: { borderRadius: 16, padding: 8, gap: 2, width: 240 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12 },
  subRow: { paddingLeft: 24, paddingVertical: 10 },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
});
