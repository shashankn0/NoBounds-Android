import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TodoSortOption } from '@/lib/todos';

// mirrors ios's UserDefaultsTodoListPreferenceStore: per-device ordering of open tasks,
// remembered across launches (extension on/off lives in extension-preferences.ts alongside
// every other home card). showCompleted is session-only on ios too, so it isn't persisted here.
const SORT_OPTION_KEY = 'todo_list_sort_option';

export async function loadTodoSortOption(): Promise<TodoSortOption> {
  const stored = await AsyncStorage.getItem(SORT_OPTION_KEY);
  if (stored === 'manual' || stored === 'dueDate' || stored === 'title' || stored === 'created' || stored === 'color') {
    return stored;
  }
  return 'manual';
}

export async function saveTodoSortOption(option: TodoSortOption): Promise<void> {
  await AsyncStorage.setItem(SORT_OPTION_KEY, option);
}
