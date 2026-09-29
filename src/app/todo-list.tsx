import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, Swipeable } from 'react-native-gesture-handler';
import Animated, { LinearTransition, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TodoItemRow } from '@/components/todo-item-row';
import { TodoOptionsMenu } from '@/components/todo-options-menu';
import { TodoQuickAddBar } from '@/components/todo-quick-add-bar';
import { TodoSwipeAction } from '@/components/todo-swipe-action';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { loadTodoSortOption, saveTodoSortOption } from '@/lib/todo-preferences';
import {
  buildTodoSections,
  completedSubtaskCount,
  createTodoItem,
  deleteCompletedTodoItems,
  deleteTodoItem,
  fetchTodoItems,
  locateTodo,
  nudgeTodoItem,
  reorderTodoItems,
  setTodoCompleted,
  subscribeTodoChanges,
  type TodoItem,
  type TodoListOwner,
  type TodoSortOption,
  type TodoTaskGroup,
} from '@/lib/todos';

const RELOAD_DEBOUNCE_MS = 300;

// where a dragged row's finger position would land among the other open rows — same approach
// as extensions.tsx's hoverIndex, reused here for the "Reorder" mode's manual sort
function hoverIndex(order: string[], rowHeights: Record<string, number>, draggedId: string, centerY: number): number {
  'worklet';
  const others = order.filter((id) => id !== draggedId);
  let cumulative = 0;
  for (let i = 0; i < others.length; i++) {
    const height = rowHeights[others[i]] ?? 0;
    const mid = cumulative + height / 2;
    if (centerY < mid) return i;
    cumulative += height;
  }
  return others.length;
}

function moveInPlace(ids: string[], from: number, to: number): string[] {
  if (from === to) return ids;
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// port of features/todos/todolistview.swift — segmented "You / Partner" lists, open and
// completed sections, swipe-to-delete (mine) / swipe-to-remind (partner), drag-to-reorder, and a
// quick-add bar. the partner's list is read-only apart from swipe-to-remind. calendar sync isn't
// ported (no Google/Apple calendar access wired up on android yet), so that menu row is omitted.
export default function TodoListScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, couple } = useSession();
  const { taskId: initialTaskId } = useLocalSearchParams<{ taskId?: string }>();

  const [items, setItems] = useState<TodoItem[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<TodoListOwner>('mine');
  const [sortOption, setSortOption] = useState<TodoSortOption>('manual');
  const [showCompleted, setShowCompleted] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [nudgedIds, setNudgedIds] = useState<Set<string>>(new Set());
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});

  const hasOpenedInitialTask = useRef(false);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentUserId = session?.user.id ?? null;
  const coupleId = couple?.id ?? null;
  const partnerName = couple?.partnerName?.trim() || 'Partner';

  const load = useCallback(
    async (full: boolean) => {
      if (!coupleId) return;
      if (full) setLoading(true);
      setError(null);
      try {
        const rows = await fetchTodoItems(coupleId);
        setItems(rows);
        // once the first load lands, jump straight to the task named by a push/deep link
        if (full && !hasOpenedInitialTask.current && initialTaskId && currentUserId) {
          const location = locateTodo(initialTaskId, rows, currentUserId);
          if (location) {
            hasOpenedInitialTask.current = true;
            setSelectedOwner(location.owner);
            router.push({ pathname: '/todo-item-detail', params: { taskId: location.taskId } });
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load your to-do list');
      } finally {
        if (full) setLoading(false);
      }
    },
    [coupleId, initialTaskId, currentUserId]
  );

  useFocusEffect(
    useCallback(() => {
      loadTodoSortOption().then(setSortOption);
      load(true);

      if (!coupleId) return;
      // realtime: coalesce bursts of change events (a reorder touches every row) into one reload
      let reloadTimer: ReturnType<typeof setTimeout> | null = null;
      const unsubscribe = subscribeTodoChanges(coupleId, (event) => {
        if (event.type === 'deleted') {
          setItems((prev) => prev.filter((i) => i.id !== event.id && i.parent_id !== event.id));
          return;
        }
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => load(false), RELOAD_DEBOUNCE_MS);
      });

      return () => {
        if (reloadTimer) clearTimeout(reloadTimer);
        unsubscribe();
      };
    }, [load, coupleId])
  );

  // a silent refresh on returning to the foreground, like ios's scenePhase handling
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load(false);
    });
    return () => sub.remove();
  }, [load]);

  function showStatus(message: string) {
    setStatusMessage(message);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatusMessage(null), 4000);
  }
  useEffect(() => () => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
  }, []);

  const canEdit = selectedOwner === 'mine';
  const sections = currentUserId ? buildTodoSections(items, selectedOwner, currentUserId, sortOption) : { open: [], completed: [] };
  const canReorder = canEdit && sortOption === 'manual';

  async function onChangeSort(option: TodoSortOption) {
    setSortOption(option);
    setIsReordering(false);
    await saveTodoSortOption(option);
  }

  async function onToggleCompletion(item: TodoItem) {
    const wasMine = item.owner_user_id === currentUserId;
    if (!wasMine) return;
    const nextCompleted = !item.is_completed;
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((current) => {
        if (current.id === item.id) return { ...current, is_completed: nextCompleted, completed_at: nextCompleted ? now : null };
        if (nextCompleted && current.parent_id === item.id && !current.is_completed) {
          return { ...current, is_completed: true, completed_at: now };
        }
        return current;
      })
    );
    try {
      await setTodoCompleted(item.id, nextCompleted);
    } catch (err) {
      load(false);
      setError(err instanceof Error ? err.message : 'Could not update that task');
    }
  }

  async function onAddTask(title: string): Promise<boolean> {
    if (!coupleId || !currentUserId) return false;
    const siblings = items.filter((i) => i.owner_user_id === currentUserId && i.parent_id === null);
    const sortOrder = siblings.reduce((max, i) => Math.max(max, i.sort_order), 0) + 1;
    try {
      const created = await createTodoItem(coupleId, currentUserId, { title, sortOrder });
      setItems((prev) => (prev.some((i) => i.id === created.id) ? prev : [...prev, created]));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that task');
      return false;
    }
  }

  async function onDelete(item: TodoItem) {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id && i.parent_id !== item.id));
    try {
      await deleteTodoItem(item.id);
    } catch (err) {
      setItems(previous);
      setError(err instanceof Error ? err.message : 'Could not delete that task');
    }
  }

  async function onClearCompleted() {
    if (!coupleId || !currentUserId) return;
    const previous = items;
    const doomed = new Set(items.filter((i) => i.owner_user_id === currentUserId && i.is_completed && i.parent_id === null).map((i) => i.id));
    if (doomed.size === 0) return;
    setItems((prev) => prev.filter((i) => !doomed.has(i.id) && !(i.parent_id && doomed.has(i.parent_id))));
    try {
      await deleteCompletedTodoItems(coupleId, currentUserId);
    } catch (err) {
      setItems(previous);
      setError(err instanceof Error ? err.message : 'Could not clear completed tasks');
    }
  }

  async function onNudge(item: TodoItem) {
    if (nudgingId || item.owner_user_id === currentUserId) return;
    setNudgingId(item.id);
    try {
      const sent = await nudgeTodoItem(item.id);
      setNudgedIds((prev) => new Set(prev).add(item.id));
      showStatus(sent ? `Reminder sent to ${partnerName}.` : `${partnerName} was already reminded about this recently.`);
    } catch (err) {
      showStatus(err instanceof Error ? err.message : 'Could not send that reminder');
    } finally {
      setNudgingId(null);
    }
  }

  async function onReorder(nextOrder: string[]) {
    const previous = items;
    const positions = new Map(nextOrder.map((id, index) => [id, index + 1]));
    setItems((prev) => prev.map((i) => (positions.has(i.id) ? { ...i, sort_order: positions.get(i.id)! } : i)));
    try {
      await reorderTodoItems(nextOrder);
    } catch (err) {
      setItems(previous);
      setError(err instanceof Error ? err.message : 'Could not reorder your tasks');
    }
  }

  function onRowLayout(id: string, e: LayoutChangeEvent) {
    const height = e.nativeEvent.layout.height;
    setRowHeights((prev) => (prev[id] === height ? prev : { ...prev, [id]: height }));
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader
        title="To-do list"
        leftLabel={canReorder && sections.open.length > 1 ? (isReordering ? 'Done' : 'Reorder') : undefined}
        onLeftPress={() => setIsReordering((v) => !v)}
        rightSlot={
          <View style={styles.headerRight}>
            <TodoOptionsMenu
              sortOption={sortOption}
              onChangeSort={onChangeSort}
              showCompleted={showCompleted}
              onToggleShowCompleted={() => setShowCompleted((v) => !v)}
              canClearCompleted={canEdit && sections.completed.length > 0}
              onClearCompleted={onClearCompleted}
            />
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={8}>
              <ThemedText type="bodyBold" themeColor="accent">
                Done
              </ThemedText>
            </Pressable>
          </View>
        }
      />

      <View style={[styles.segmented, { backgroundColor: theme.backgroundSecondary }]}>
        {(['mine', 'partner'] as TodoListOwner[]).map((owner) => (
          <Pressable
            key={owner}
            onPress={() => {
              setSelectedOwner(owner);
              setIsReordering(false);
            }}
            style={styles.segmentWrap}>
            <View style={[styles.segment, selectedOwner === owner && { backgroundColor: theme.surface }]}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {owner === 'mine' ? 'You' : partnerName}
              </ThemedText>
            </View>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {loading ? (
          <NBCard>
            <ThemedText type="default" themeColor="textSecondary">
              Loading…
            </ThemedText>
          </NBCard>
        ) : (
          <>
            {error ? (
              <ThemedText type="small" themeColor="destructive" style={styles.errorText}>
                {error}
              </ThemedText>
            ) : null}

            <ThemedText type="small" themeColor="textSecondary" style={styles.floatingHeader}>
              Open · {sections.open.length}
            </ThemedText>
            <NBCard style={styles.sectionCard}>
              {sections.open.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {canEdit ? 'Nothing to do — add a task below.' : `${partnerName} has nothing open right now.`}
                </ThemedText>
              ) : (
                sections.open.map((group, index) => (
                  <Row
                    key={group.task.id}
                    group={group}
                    index={index}
                    order={sections.open.map((g) => g.task.id)}
                    rowHeights={rowHeights}
                    onRowLayout={onRowLayout}
                    canEdit={canEdit}
                    isReordering={isReordering && canReorder}
                    onDragMove={(id, target) => onReorder(moveInPlace(sections.open.map((g) => g.task.id), sections.open.findIndex((g) => g.task.id === id), target))}
                    onToggle={() => onToggleCompletion(group.task)}
                    onPress={
                      isReordering
                        ? undefined
                        : () => router.push({ pathname: '/todo-item-detail', params: { taskId: group.task.id } })
                    }
                    onDelete={canEdit ? () => onDelete(group.task) : undefined}
                    onNudge={!canEdit ? () => onNudge(group.task) : undefined}
                    hasNudged={nudgedIds.has(group.task.id)}
                  />
                ))
              )}
            </NBCard>

            {sections.completed.length > 0 ? (
              <>
                <Pressable onPress={() => setShowCompleted((v) => !v)} style={[styles.floatingHeader, styles.completedHeader]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Completed · {sections.completed.length}
                  </ThemedText>
                  <Ionicons name={showCompleted ? 'chevron-down' : 'chevron-forward'} size={14} color={theme.textSecondary} />
                </Pressable>
                {showCompleted ? (
                  <NBCard style={styles.sectionCard}>
                    {sections.completed.map((group) => (
                      <Row
                        key={group.task.id}
                        group={group}
                        index={0}
                        order={[]}
                        rowHeights={rowHeights}
                        onRowLayout={onRowLayout}
                        canEdit={canEdit}
                        isReordering={false}
                        onDragMove={() => {}}
                        onToggle={() => onToggleCompletion(group.task)}
                        onPress={() => router.push({ pathname: '/todo-item-detail', params: { taskId: group.task.id } })}
                        onDelete={canEdit ? () => onDelete(group.task) : undefined}
                      />
                    ))}
                  </NBCard>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderColor: theme.border, backgroundColor: theme.surface }]}>
        {canEdit ? (
          <TodoQuickAddBar onSubmit={onAddTask} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {statusMessage ?? `You're viewing ${partnerName}'s list — swipe a task to send a reminder.`}
          </ThemedText>
        )}
      </View>
    </ThemedView>
  );
}

function Row({
  group,
  index,
  order,
  rowHeights,
  onRowLayout,
  canEdit,
  isReordering,
  onDragMove,
  onToggle,
  onPress,
  onDelete,
  onNudge,
  hasNudged,
}: {
  group: TodoTaskGroup;
  index: number;
  order: string[];
  rowHeights: Record<string, number>;
  onRowLayout: (id: string, e: LayoutChangeEvent) => void;
  canEdit: boolean;
  isReordering: boolean;
  onDragMove: (id: string, target: number) => void;
  onToggle: () => void;
  onPress?: () => void;
  onDelete?: () => void;
  onNudge?: () => void;
  hasNudged?: boolean;
}) {
  const theme = useTheme();
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const pan = Gesture.Pan()
    .enabled(isReordering)
    .onBegin(() => {
      isDragging.value = true;
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
      let baseTop = 0;
      for (let i = 0; i < order.length; i++) {
        if (order[i] === group.task.id) break;
        baseTop += rowHeights[order[i]] ?? 0;
      }
      const height = rowHeights[group.task.id] ?? 0;
      const centerY = baseTop + e.translationY + height / 2;
      const target = hoverIndex(order, rowHeights, group.task.id, centerY);
      runOnJS(onDragMove)(group.task.id, target);
    })
    .onEnd(() => {
      isDragging.value = false;
      translateY.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: isDragging.value ? 1 : 0,
    backgroundColor: isDragging.value ? theme.backgroundSecondary : 'transparent',
  }));

  const rowContent = (
    <View style={styles.rowInner}>
      <View style={styles.rowFlex}>
        <TodoItemRow
          item={group.task}
          subtaskProgress={{ completed: completedSubtaskCount(group), total: group.subtasks.length }}
          isEditable={canEdit}
          onToggle={onToggle}
          onPress={onPress}
        />
      </View>
      {isReordering ? (
        <GestureDetector gesture={pan}>
          <View hitSlop={8} style={styles.dragHandle}>
            <Ionicons name="reorder-three" size={22} color={theme.textSecondary} />
          </View>
        </GestureDetector>
      ) : null}
    </View>
  );

  const swipeable = onDelete ? (
    <Swipeable renderRightActions={() => <TodoSwipeAction color={theme.destructive} icon="trash" label="Delete" onPress={onDelete} />}>
      {rowContent}
    </Swipeable>
  ) : onNudge ? (
    <Swipeable
      renderLeftActions={() => (
        <TodoSwipeAction color={theme.accent} icon={hasNudged ? 'notifications' : 'notifications-outline'} label={hasNudged ? 'Reminded' : 'Remind'} onPress={onNudge} />
      )}>
      {rowContent}
    </Swipeable>
  ) : (
    rowContent
  );

  return (
    <Animated.View
      layout={LinearTransition}
      onLayout={(e) => onRowLayout(group.task.id, e)}
      style={[isReordering && animatedStyle, index > 0 && [styles.rowDivider, { borderColor: theme.separator }]]}>
      {swipeable}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 4, marginHorizontal: 16, marginBottom: 8 },
  segmentWrap: { flex: 1 },
  segment: { paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  sectionCard: { gap: 8, padding: 12 },
  floatingHeader: { paddingHorizontal: 4, marginBottom: -4 },
  completedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { marginBottom: 4 },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowFlex: { flex: 1 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4, marginTop: 4 },
  dragHandle: { padding: 4 },
  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
