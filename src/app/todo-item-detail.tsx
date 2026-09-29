import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DatePickerField } from '@/components/date-picker-field';
import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimePickerField } from '@/components/time-picker-field';
import { TodoColorLabel, TodoColorPicker } from '@/components/todo-color-picker';
import { TodoItemRow } from '@/components/todo-item-row';
import { TodoQuickAddBar } from '@/components/todo-quick-add-bar';
import { TodoSwipeAction } from '@/components/todo-swipe-action';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { dateKey } from '@/lib/habits';
import {
  createTodoItem,
  defaultDueTime,
  deleteTodoItem,
  fetchTodoItems,
  nudgeTodoItem,
  setTodoCompleted,
  todoDueLabel,
  updateTodoItem,
  type TodoColor,
  type TodoItem,
} from '@/lib/todos';

// port of features/todos/todoitemdetailsheet.swift — edit title, notes, due date/time, and color
// tag; manage subtasks; delete. read-only when the task belongs to the partner (they can only
// send a reminder about it, mirroring the list's swipe-to-remind).
export default function TodoItemDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, couple } = useSession();
  const { taskId } = useLocalSearchParams<{ taskId: string }>();

  const [items, setItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNudged, setHasNudged] = useState(false);
  const [nudging, setNudging] = useState(false);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [hasDueDate, setHasDueDate] = useState(false);
  const [hasDueTime, setHasDueTime] = useState(false);
  const [dueDateKey, setDueDateKey] = useState(() => dateKey(new Date()));
  const [dueTime, setDueTime] = useState('09:00');
  const [color, setColor] = useState<TodoColor | null>(null);
  const [hasLoadedFields, setHasLoadedFields] = useState(false);

  const coupleId = couple?.id ?? null;
  const currentUserId = session?.user.id ?? null;
  const partnerName = couple?.partnerName?.trim() || 'Partner';

  const load = useCallback(async () => {
    if (!coupleId) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchTodoItems(coupleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load that task');
    } finally {
      setLoading(false);
    }
  }, [coupleId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const task = items.find((i) => i.id === taskId) ?? null;
  const subtasks = items.filter((i) => i.parent_id === taskId).sort((a, b) => a.sort_order - b.sort_order);
  const isEditable = !!task && task.owner_user_id === currentUserId;

  if (task && !hasLoadedFields) {
    setHasLoadedFields(true);
    setTitle(task.title);
    setNotes(task.notes);
    setHasDueDate(!!task.due);
    setHasDueTime(!!task.due?.time);
    setDueDateKey(task.due?.dateKey ?? dateKey(new Date()));
    setDueTime(task.due?.time ?? defaultDueTime(task.due?.dateKey ?? dateKey(new Date())));
    setColor(task.color);
  }

  function onToggleDueDate(next: boolean) {
    setHasDueDate(next);
    if (next && !hasDueTime) setDueTime(defaultDueTime(dueDateKey));
  }

  function onChangeDueDateKey(next: string) {
    setDueDateKey(next);
    if (hasDueTime) setDueTime(defaultDueTime(next));
  }

  async function onSave() {
    if (!task || !title.trim() || saving) return;
    setSaving(true);
    try {
      await updateTodoItem(task.id, {
        title: title.trim(),
        notes: notes.trim(),
        due: hasDueDate ? { dateKey: dueDateKey, time: hasDueTime ? dueTime : null } : null,
        color,
      });
      closeDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this task');
      setSaving(false);
    }
  }

  function onDelete() {
    if (!task) return;
    Alert.alert(
      'Delete this task?',
      subtasks.length > 0 ? `Its ${subtasks.length} subtasks will be deleted too.` : undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete task',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTodoItem(task.id);
              closeDetail();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not delete this task');
            }
          },
        },
      ]
    );
  }

  async function onToggleSubtask(subtask: TodoItem) {
    setItems((prev) => prev.map((i) => (i.id === subtask.id ? { ...i, is_completed: !i.is_completed } : i)));
    try {
      await setTodoCompleted(subtask.id, !subtask.is_completed);
    } catch {
      load();
    }
  }

  async function onDeleteSubtask(subtask: TodoItem) {
    setItems((prev) => prev.filter((i) => i.id !== subtask.id));
    try {
      await deleteTodoItem(subtask.id);
    } catch {
      load();
    }
  }

  async function onAddSubtask(subtaskTitle: string): Promise<boolean> {
    if (!task || !coupleId || !currentUserId) return false;
    const sortOrder = subtasks.reduce((max, s) => Math.max(max, s.sort_order), 0) + 1;
    try {
      const created = await createTodoItem(coupleId, currentUserId, { title: subtaskTitle, parentId: task.id, sortOrder });
      setItems((prev) => [...prev, created]);
      return true;
    } catch {
      return false;
    }
  }

  // guards against expo-router's "GO_BACK not handled" warning when this screen is the first
  // one on the stack (e.g. a cold app launch deep-linked straight here from a push notification)
  function closeDetail() {
    if (router.canGoBack()) router.back();
    else router.replace('/todo-list');
  }

  async function onNudge() {
    if (!task || nudging) return;
    setNudging(true);
    try {
      await nudgeTodoItem(task.id);
      setHasNudged(true);
    } catch {
      // best-effort — the list's own swipe-to-remind is the primary path
    } finally {
      setNudging(false);
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader
        title={isEditable ? 'Edit task' : 'Task'}
        leftLabel={isEditable ? 'Cancel' : 'Close'}
        onLeftPress={closeDetail}
        rightLabel={isEditable ? (saving ? 'Saving…' : 'Save') : undefined}
        onRightPress={onSave}
        rightDisabled={!title.trim() || saving}
      />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        {loading ? (
          <ThemedText type="default" themeColor="textSecondary">
            Loading…
          </ThemedText>
        ) : !task ? (
          <ThemedText type="default" themeColor="textSecondary">
            This task was removed.
          </ThemedText>
        ) : (
          <>
            <NBCard style={styles.section}>
              <ThemedText type="small" themeColor="textSecondary">
                Task
              </ThemedText>
              {isEditable ? (
                <>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Title"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
                  />
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Notes"
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    style={[styles.input, styles.notesInput, { color: theme.textPrimary, borderColor: theme.border }]}
                  />
                </>
              ) : (
                <>
                  <ThemedText type="default">{task.title}</ThemedText>
                  {task.notes ? (
                    <ThemedText type="default" themeColor="textSecondary">
                      {task.notes}
                    </ThemedText>
                  ) : null}
                </>
              )}
            </NBCard>

            <NBCard style={styles.section}>
              <ThemedText type="small" themeColor="textSecondary">
                Due date
              </ThemedText>
              {isEditable ? (
                <>
                  <View style={styles.toggleRow}>
                    <ThemedText type="default">Has a due date</ThemedText>
                    <Switch
                      value={hasDueDate}
                      onValueChange={onToggleDueDate}
                      trackColor={{ false: theme.border, true: theme.accent }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                  {hasDueDate ? (
                    <>
                      <DatePickerField label="Due" value={dueDateKey} onChange={onChangeDueDateKey} />
                      <View style={styles.toggleRow}>
                        <ThemedText type="default">Set a time</ThemedText>
                        <Switch
                          value={hasDueTime}
                          onValueChange={setHasDueTime}
                          trackColor={{ false: theme.border, true: theme.accent }}
                          thumbColor="#FFFFFF"
                        />
                      </View>
                      {hasDueTime ? <TimePickerField label="Time" value={dueTime} onChange={setDueTime} /> : null}
                    </>
                  ) : null}
                </>
              ) : task.due ? (
                <ThemedText type="default" style={{ color: theme.textPrimary }}>
                  {todoDueLabel(task.due)}
                </ThemedText>
              ) : (
                <ThemedText type="default" themeColor="textSecondary">
                  No due date
                </ThemedText>
              )}
            </NBCard>

            <NBCard style={styles.section}>
              <ThemedText type="small" themeColor="textSecondary">
                Color
              </ThemedText>
              {isEditable ? <TodoColorPicker selection={color} onChange={setColor} /> : <TodoColorLabel color={task.color} />}
            </NBCard>

            <NBCard style={styles.section}>
              <View style={styles.subtaskHeader}>
                <ThemedText type="small" themeColor="textSecondary">
                  {subtasks.length === 0 ? 'Subtasks' : `Subtasks · ${subtasks.filter((s) => s.is_completed).length}/${subtasks.length}`}
                </ThemedText>
              </View>
              {subtasks.map((subtask) =>
                isEditable ? (
                  <Swipeable
                    key={subtask.id}
                    renderRightActions={() => <TodoSwipeAction color={theme.destructive} icon="trash" label="Delete" onPress={() => onDeleteSubtask(subtask)} />}>
                    <TodoItemRow item={subtask} inheritedColor={task.color} onToggle={() => onToggleSubtask(subtask)} />
                  </Swipeable>
                ) : (
                  <TodoItemRow key={subtask.id} item={subtask} isEditable={false} inheritedColor={task.color} onToggle={() => {}} />
                )
              )}
              {isEditable ? (
                <TodoQuickAddBar placeholder="Add a subtask…" showsBackground={false} onSubmit={onAddSubtask} />
              ) : subtasks.length === 0 ? (
                <ThemedText type="default" themeColor="textSecondary">
                  No subtasks
                </ThemedText>
              ) : null}
            </NBCard>

            {isEditable ? (
              <NBCard>
                <Pressable onPress={onDelete} style={styles.deleteRow}>
                  <Ionicons name="trash" size={18} color={theme.destructive} />
                  <ThemedText type="default" themeColor="destructive">
                    Delete task
                  </ThemedText>
                </Pressable>
              </NBCard>
            ) : !task.is_completed ? (
              <NBCard>
                <Pressable onPress={onNudge} disabled={hasNudged || nudging} style={[styles.deleteRow, (hasNudged || nudging) && { opacity: 0.5 }]}>
                  <Ionicons name={hasNudged ? 'notifications' : 'notifications-outline'} size={18} color={theme.accent} />
                  <ThemedText type="default" themeColor="accent">
                    {hasNudged ? 'Reminder sent' : `Send ${partnerName} a reminder`}
                  </ThemedText>
                </Pressable>
              </NBCard>
            ) : null}

            {error ? (
              <ThemedText type="small" themeColor="destructive">
                {error}
              </ThemedText>
            ) : null}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  section: { gap: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  notesInput: { minHeight: 70, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subtaskHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
});
