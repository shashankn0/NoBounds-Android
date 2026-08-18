import { supabase } from '@/lib/supabase';

export type Habit = {
  id: string;
  couple_id: string | null;
  owner_user_id: string;
  title: string;
  owner_scope: 'mine' | 'yours' | 'ours';
  sort_order: number;
  created_at: string;
};

export type HabitCompletion = {
  habit_id: string;
  user_id: string;
  completion_date: string;
  completed: boolean;
};

const HABIT_COLUMNS = 'id, couple_id, owner_user_id, title, owner_scope, sort_order, created_at';

export async function fetchHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select(HABIT_COLUMNS)
    .is('archived_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as Habit[]) ?? [];
}

export async function fetchTodaysCompletions(): Promise<HabitCompletion[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('habit_completions')
    .select('habit_id, user_id, completion_date, completed')
    .eq('completion_date', today);
  if (error) throw error;
  return (data as HabitCompletion[]) ?? [];
}

export type HabitOwnerScope = 'mine' | 'yours' | 'ours';
export type HabitCompletionPolicy = 'either' | 'both';

export async function createHabit(
  title: string,
  coupleId: string | null,
  ownerScope: HabitOwnerScope = coupleId ? 'ours' : 'mine',
  completionPolicy: HabitCompletionPolicy = 'either'
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const ownerUserId = userData.user?.id;
  if (!ownerUserId) throw new Error('Not signed in');

  const { error } = await supabase.from('habits').insert({
    title,
    couple_id: coupleId,
    owner_user_id: ownerUserId,
    owner_scope: ownerScope,
    completion_policy: completionPolicy,
  });
  if (error) throw error;
}

export async function toggleHabitToday(habitId: string, completed: boolean): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from('habit_completions')
    .upsert(
      { habit_id: habitId, user_id: userId, completion_date: today, completed, updated_at: new Date().toISOString() },
      { onConflict: 'habit_id,user_id,completion_date' }
    );
  if (error) throw error;
}
