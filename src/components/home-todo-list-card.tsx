import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { NBSecondaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { TodoItemRow } from '@/components/todo-item-row';
import { useTheme } from '@/hooks/use-theme';
import { loadTodoSortOption } from '@/lib/todo-preferences';
import { buildTodoSections, completedSubtaskCount, fetchTodoItems, setTodoCompleted, type TodoItem } from '@/lib/todos';

const MAX_VISIBLE_TASKS = 3;

// port of features/todos/hometodolistcard.swift — open-task counts for both partners, the next
// few of your own tasks with checkboxes, and entry into the full list. only rendered when the
// to-do extension is enabled (see extension-preferences.ts's default-off 'todo-list' entry).
export function HomeTodoListCard({
  coupleId,
  currentUserId,
  partnerName,
}: {
  coupleId: string;
  currentUserId: string;
  partnerName: string;
}) {
  const theme = useTheme();
  const [items, setItems] = useState<TodoItem[]>([]);
  const [sort, setSort] = useState<Awaited<ReturnType<typeof loadTodoSortOption>>>('manual');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [rows, sortOption] = await Promise.all([fetchTodoItems(coupleId), loadTodoSortOption()]);
      setItems(rows);
      setSort(sortOption);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your to-do list');
    } finally {
      setLoading(false);
    }
  }, [coupleId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onToggle(item: TodoItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_completed: !i.is_completed } : i)));
    try {
      await setTodoCompleted(item.id, !item.is_completed);
    } catch {
      load();
    }
  }

  if (error) {
    return (
      <NBCard>
        <ThemedText type="small" themeColor="destructive">
          {error}
        </ThemedText>
      </NBCard>
    );
  }

  const mine = buildTodoSections(items, 'mine', currentUserId, sort);
  const partner = buildTodoSections(items, 'partner', currentUserId, sort);
  const myOpen = mine.open;

  return (
    <NBCard>
      <View style={styles.headerRow}>
        <ThemedText type="title">To-do list</ThemedText>
        <MaterialIcons name="checklist" size={15} color={theme.accent} />
      </View>

      {loading ? (
        <ThemedText type="default" themeColor="textSecondary" style={styles.body}>
          Loading…
        </ThemedText>
      ) : (
        <>
          <View style={styles.countsRow}>
            <CountChip title="You" openCount={myOpen.length} theme={theme} />
            <CountChip title={partnerName} openCount={partner.open.length} theme={theme} />
          </View>

          <View style={styles.tasks}>
            {myOpen.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Nothing on your list — add a task to get started.
              </ThemedText>
            ) : (
              <>
                {myOpen.slice(0, MAX_VISIBLE_TASKS).map((group) => (
                  <TodoItemRow
                    key={group.task.id}
                    item={group.task}
                    subtaskProgress={{ completed: completedSubtaskCount(group), total: group.subtasks.length }}
                    onToggle={() => onToggle(group.task)}
                    onPress={() => router.push('/todo-list')}
                  />
                ))}
                {myOpen.length > MAX_VISIBLE_TASKS ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    +{myOpen.length - MAX_VISIBLE_TASKS} more
                  </ThemedText>
                ) : null}
              </>
            )}
          </View>
        </>
      )}

      <View style={styles.cardButton}>
        <NBSecondaryButton title="Open list" onPress={() => router.push('/todo-list')} />
      </View>
    </NBCard>
  );
}

function CountChip({ title, openCount, theme }: { title: string; openCount: number; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={[styles.countChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <ThemedText type="smallBold" numberOfLines={1} style={styles.countChipTitle}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {openCount === 1 ? '1 open' : `${openCount} open`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  body: { marginTop: 8 },
  countsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  countChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, flexShrink: 1 },
  countChipTitle: { flexShrink: 1 },
  tasks: { marginTop: 10, gap: 2 },
  cardButton: { marginTop: 12 },
});
