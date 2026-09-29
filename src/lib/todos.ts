import { supabase } from '@/lib/supabase';
import { dateKey } from '@/lib/habits';

// port of core/domain/todos/{todocolor,tododue,todomodels,todorepository,tododtos,
// todosortoption}.swift — a couple's to-do lists: each partner owns theirs (one level of
// subtasks), both partners can read both, only the owner can write to theirs. table is
// public.couple_todo_items; reorder_todo_items/nudge_todo_item are rpc functions.

export type TodoColor = 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink';

// ios's TodoColor.allCases order — also the "Color" sort order
export const TODO_COLORS: TodoColor[] = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];

// apple's system colors (light-mode hex) — ios's swiftUIColor adapts per-appearance; these read
// fine on both this app's light and dark surfaces since they're already saturated/bright
const TODO_COLOR_HEX: Record<TodoColor, string> = {
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  green: '#34C759',
  teal: '#30B0C7',
  blue: '#007AFF',
  purple: '#AF52DE',
  pink: '#FF2D55',
};

export function todoColorHex(color: TodoColor): string {
  return TODO_COLOR_HEX[color];
}

export function todoColorLabel(color: TodoColor): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

// when a task is due: a local calendar day, optionally at a specific time. stored as
// due_date (yyyy-mm-dd) + due_time (HH:MM:SS), the owner's wall-clock day/time — matches
// ios's TodoDue exactly, just represented as plain strings instead of a Date
export type TodoDue = { dateKey: string; time: string | null };

export type TodoItem = {
  id: string;
  couple_id: string;
  owner_user_id: string;
  parent_id: string | null;
  title: string;
  notes: string;
  due: TodoDue | null;
  color: TodoColor | null;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
};

export type NewTodoItem = {
  title: string;
  notes?: string;
  due?: TodoDue | null;
  color?: TodoColor | null;
  parentId?: string | null;
  sortOrder: number;
};

export type TodoItemEdit = {
  title: string;
  notes: string;
  due: TodoDue | null;
  color: TodoColor | null;
};

export type TodoListOwner = 'mine' | 'partner';

export type TodoTaskGroup = { task: TodoItem; subtasks: TodoItem[] };

export type TodoListSections = { open: TodoTaskGroup[]; completed: TodoTaskGroup[] };

export const EMPTY_TODO_SECTIONS: TodoListSections = { open: [], completed: [] };

export type TodoTaskLocation = { owner: TodoListOwner; taskId: string };

export type TodoChangeEvent = { type: 'changed' } | { type: 'deleted'; id: string };

export function isSubtask(item: TodoItem): boolean {
  return item.parent_id !== null;
}

// open tasks whose due day (or due time, when set) has passed — mirrors ios's TodoItem.isOverdue
export function isTodoOverdue(item: TodoItem, now: Date = new Date()): boolean {
  if (item.is_completed || !item.due) return false;
  return isDuePast(item.due, now);
}

function isDuePast(due: TodoDue, now: Date): boolean {
  if (due.time) {
    return dueDateTime(due) < now;
  }
  return due.dateKey < dateKey(now);
}

function dueDateTime(due: TodoDue): Date {
  const [year, month, day] = due.dateKey.split('-').map(Number);
  if (!due.time) return new Date(year, month - 1, day);
  const [hour, minute] = due.time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

// "Today", "Tomorrow", "Yesterday", or a compact date, followed by the time when set — mirrors
// ios's TodoDue.label() exactly (including "MMM d" / "MMM d, yyyy" for a different year)
export function todoDueLabel(due: TodoDue, now: Date = new Date()): string {
  const day = dueDayLabel(due, now);
  if (!due.time) return day;
  return `${day}, ${formatTime(due.time)}`;
}

function dueDayLabel(due: TodoDue, now: Date): string {
  const today = dateKey(now);
  if (due.dateKey === today) return 'Today';
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (due.dateKey === dateKey(tomorrow)) return 'Tomorrow';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (due.dateKey === dateKey(yesterday)) return 'Yesterday';

  const [year, month, day] = due.dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const sameYear = year === now.getFullYear();
  return date.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(time: string): string {
  const [hour24, minute] = time.split(':').map(Number);
  const period = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

// a sensible default time for turning "set a time" on: 9:00 AM, or the next full hour if 9:00
// has already passed today — mirrors ios's TodoItemDetailSheet.pickerDate
export function defaultDueTime(dateKeyValue: string, now: Date = new Date()): string {
  const isToday = dateKeyValue === dateKey(now);
  if (!isToday || now.getHours() < 9) return '09:00';
  const nextHour = (now.getHours() + 1) % 24;
  return `${String(nextHour).padStart(2, '0')}:00`;
}

// ============ sort ============

export type TodoSortOption = 'manual' | 'dueDate' | 'title' | 'created' | 'color';

export const TODO_SORT_OPTIONS: { id: TodoSortOption; title: string; icon: string }[] = [
  { id: 'manual', title: 'Manual', icon: 'reorder-three' },
  { id: 'dueDate', title: 'Due date', icon: 'calendar' },
  { id: 'title', title: 'Title', icon: 'text' },
  { id: 'created', title: 'Date created', icon: 'time' },
  { id: 'color', title: 'Color', icon: 'color-palette' },
];

// manual position first, then creation order and id as stable tie-breakers — mirrors ios's
// TodoSortOption.isManuallyBefore
function compareManual(a: TodoItem, b: TodoItem): number {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function compareByOptionalKey<K>(a: TodoItem, b: TodoItem, key: (item: TodoItem) => K | null, compareKey: (x: K, y: K) => number): number {
  const ak = key(a);
  const bk = key(b);
  if (ak !== null && bk !== null) {
    const cmp = compareKey(ak, bk);
    if (cmp !== 0) return cmp;
  } else if (ak !== null) {
    return -1;
  } else if (bk !== null) {
    return 1;
  }
  return compareManual(a, b);
}

export function compareTodosBySort(sort: TodoSortOption, a: TodoItem, b: TodoItem): number {
  switch (sort) {
    case 'manual':
      return compareManual(a, b);
    case 'dueDate':
      return compareByOptionalKey(
        a,
        b,
        (item) => (item.due ? item.due.dateKey + (item.due.time ?? '') : null),
        (x, y) => (x < y ? -1 : x > y ? 1 : 0)
      );
    case 'title': {
      const cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      return cmp !== 0 ? cmp : compareManual(a, b);
    }
    case 'created':
      return a.created_at !== b.created_at ? (a.created_at > b.created_at ? -1 : 1) : compareManual(a, b);
    case 'color':
      return compareByOptionalKey(
        a,
        b,
        (item) => (item.color ? TODO_COLORS.indexOf(item.color) : null),
        (x, y) => x - y
      );
  }
}

// most recently completed first — mirrors ios's isRecentlyCompletedBefore
function compareRecentlyCompleted(a: TodoItem, b: TodoItem): number {
  const ad = a.completed_at ?? a.created_at;
  const bd = b.completed_at ?? b.created_at;
  return ad !== bd ? (ad > bd ? -1 : 1) : compareManual(a, b);
}

function orderedByManual(items: TodoItem[]): TodoItem[] {
  return [...items].sort(compareManual);
}

// groups the requested partner's items into open and completed top-level tasks, each carrying
// its ordered subtasks — mirrors ios's TodoListBuilder.sections
export function buildTodoSections(items: TodoItem[], owner: TodoListOwner, currentUserId: string, sort: TodoSortOption): TodoListSections {
  const owned = items.filter((item) => (owner === 'mine' ? item.owner_user_id === currentUserId : item.owner_user_id !== currentUserId));

  const subtasksByParent = new Map<string, TodoItem[]>();
  for (const item of owned) {
    if (item.parent_id) {
      const list = subtasksByParent.get(item.parent_id) ?? [];
      list.push(item);
      subtasksByParent.set(item.parent_id, list);
    }
  }

  const groups: TodoTaskGroup[] = owned
    .filter((item) => !isSubtask(item))
    .map((task) => ({ task, subtasks: orderedByManual(subtasksByParent.get(task.id) ?? []) }));

  const open = groups.filter((g) => !g.task.is_completed).sort((a, b) => compareTodosBySort(sort, a.task, b.task));
  const completed = groups.filter((g) => g.task.is_completed).sort((a, b) => compareRecentlyCompleted(a.task, b.task));

  return { open, completed };
}

export function completedSubtaskCount(group: TodoTaskGroup): number {
  return group.subtasks.filter((s) => s.is_completed).length;
}

// resolves a task or subtask id (e.g. from a push) to the list and detail sheet that show it
export function locateTodo(taskId: string, items: TodoItem[], currentUserId: string): TodoTaskLocation | null {
  const item = items.find((i) => i.id === taskId);
  if (!item) return null;
  const owner: TodoListOwner = item.owner_user_id === currentUserId ? 'mine' : 'partner';
  return { owner, taskId: item.parent_id ?? item.id };
}

// ============ backend ============

const TODO_COLUMNS = 'id, couple_id, owner_user_id, parent_id, title, notes, due_date, due_time, color, is_completed, completed_at, sort_order, created_at';

type TodoRow = {
  id: string;
  couple_id: string;
  owner_user_id: string;
  parent_id: string | null;
  title: string;
  notes: string | null;
  due_date: string | null;
  due_time: string | null;
  color: string | null;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
};

function rowToItem(row: TodoRow): TodoItem {
  const color = row.color && (TODO_COLORS as string[]).includes(row.color) ? (row.color as TodoColor) : null;
  const due = row.due_date ? { dateKey: row.due_date, time: row.due_time ? row.due_time.slice(0, 5) : null } : null;
  return {
    id: row.id,
    couple_id: row.couple_id,
    owner_user_id: row.owner_user_id,
    parent_id: row.parent_id,
    title: row.title,
    notes: row.notes ?? '',
    due,
    color,
    is_completed: row.is_completed,
    completed_at: row.completed_at,
    sort_order: row.sort_order,
    created_at: row.created_at,
  };
}

export async function fetchTodoItems(coupleId: string): Promise<TodoItem[]> {
  const { data, error } = await supabase
    .from('couple_todo_items')
    .select(TODO_COLUMNS)
    .eq('couple_id', coupleId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data as TodoRow[] | null) ?? []).map(rowToItem);
}

export async function createTodoItem(coupleId: string, ownerUserId: string, item: NewTodoItem): Promise<TodoItem> {
  const { data, error } = await supabase
    .from('couple_todo_items')
    .insert({
      couple_id: coupleId,
      owner_user_id: ownerUserId,
      parent_id: item.parentId ?? null,
      title: item.title.trim(),
      notes: (item.notes ?? '').trim(),
      due_date: item.due?.dateKey ?? null,
      due_time: item.due?.time ? `${item.due.time}:00` : null,
      color: item.color ?? null,
      sort_order: item.sortOrder,
    })
    .select(TODO_COLUMNS)
    .single();
  if (error) throw error;
  return rowToItem(data as TodoRow);
}

export async function updateTodoItem(id: string, edit: TodoItemEdit): Promise<TodoItem> {
  const { data, error } = await supabase
    .from('couple_todo_items')
    .update({
      title: edit.title.trim(),
      notes: edit.notes.trim(),
      // explicit nulls so clearing the due date/time/color persists, like ios
      due_date: edit.due?.dateKey ?? null,
      due_time: edit.due?.time ? `${edit.due.time}:00` : null,
      color: edit.color ?? null,
    })
    .eq('id', id)
    .select(TODO_COLUMNS)
    .single();
  if (error) throw error;
  return rowToItem(data as TodoRow);
}

// completing a task also completes its still-open subtasks in the same round trip; un-completing
// only affects the task itself — mirrors ios's LiveTodoRepository.setCompleted
export async function setTodoCompleted(id: string, completed: boolean): Promise<void> {
  const update = { is_completed: completed, completed_at: completed ? new Date().toISOString() : null };
  const query = supabase.from('couple_todo_items').update(update);
  if (completed) {
    const { error } = await query.or(`id.eq.${id},parent_id.eq.${id}`).eq('is_completed', false);
    if (error) throw error;
  } else {
    const { error } = await query.eq('id', id);
    if (error) throw error;
  }
}

export async function deleteTodoItem(id: string): Promise<void> {
  const { error } = await supabase.from('couple_todo_items').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteCompletedTodoItems(coupleId: string, ownerUserId: string): Promise<void> {
  const { error } = await supabase
    .from('couple_todo_items')
    .delete()
    .eq('couple_id', coupleId)
    .eq('owner_user_id', ownerUserId)
    .eq('is_completed', true)
    .is('parent_id', null);
  if (error) throw error;
}

export async function reorderTodoItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.rpc('reorder_todo_items', { p_item_ids: ids });
  if (error) throw error;
}

// pushes a "remind" notification to the task's owner; false means nothing new was sent (nudged
// within the last hour, or they have the category off) — mirrors ios's nudge_todo_item rpc
export async function nudgeTodoItem(itemId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('nudge_todo_item', { p_item_id: itemId });
  if (error) throw error;
  return data as boolean;
}

// live change notifications for the couple's lists — inserts/updates coalesce to "changed";
// deletes only carry the row's id since RLS strips the rest, so callers filter to ids they know
export function subscribeTodoChanges(coupleId: string, onEvent: (event: TodoChangeEvent) => void): () => void {
  const channel = supabase
    .channel(`todo-items-${coupleId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'couple_todo_items', filter: `couple_id=eq.${coupleId}` },
      () => onEvent({ type: 'changed' })
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'couple_todo_items', filter: `couple_id=eq.${coupleId}` },
      () => onEvent({ type: 'changed' })
    )
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'couple_todo_items' }, (payload) => {
      const id = (payload.old as { id?: string } | null)?.id;
      if (id) onEvent({ type: 'deleted', id });
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
