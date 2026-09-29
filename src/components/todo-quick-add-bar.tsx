import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// port of features/todos/todoquickaddbar.swift — single-line task entry: submit with the return
// key or the Add label; the plus icon focuses the field. keeps focus after a successful add so
// several tasks can be entered in a row.
export function TodoQuickAddBar({
  placeholder = 'Add a task…',
  showsBackground = true,
  onSubmit,
}: {
  placeholder?: string;
  showsBackground?: boolean;
  onSubmit: (title: string) => Promise<boolean>;
}) {
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const inputRef = useRef<TextInput>(null);
  const trimmed = title.trim();

  async function submit() {
    const newTitle = trimmed;
    if (!newTitle) return;
    if (await onSubmit(newTitle)) {
      setTitle('');
      inputRef.current?.focus();
    }
  }

  return (
    <View
      style={[
        styles.row,
        showsBackground && [styles.withBackground, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }],
      ]}>
      <Pressable
        onPress={() => (trimmed ? submit() : inputRef.current?.focus())}
        hitSlop={8}
        accessibilityLabel={trimmed ? 'Add task' : 'New task'}>
        <Ionicons name="add-circle" size={26} color={theme.accent} />
      </Pressable>

      <TextInput
        ref={inputRef}
        value={title}
        onChangeText={setTitle}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        returnKeyType="done"
        onSubmitEditing={submit}
        style={[styles.input, { color: theme.textPrimary }]}
      />

      {trimmed ? (
        <Pressable onPress={submit} hitSlop={8}>
          <ThemedText type="bodyBold" themeColor="accent">
            Add
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  withBackground: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  input: { flex: 1, fontSize: 16, paddingVertical: 4 },
});
