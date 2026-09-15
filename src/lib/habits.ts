import { supabase } from '@/lib/supabase';

// a habit — solo (couple_id null) until pairing merges it into the couple
export type Habit = {
  id: string;
  couple_id: string | null;
  owner_user_id: string;
  title: string;
  owner_scope: 'mine' | 'yours' | 'ours';
  sort_order: number;
  created_at: string;
  // real-backend-only columns — not written by this app yet, but selected so nothing chokes
  // if a habit created by the real ios app has them set
  habit_kind: 'standard' | 'weeks_bound' | 'bound_streak';
  reminder_hour: number | null;
};

// one user's check-in for one habit on one day
export type HabitCompletion = {
  habit_id: string;
  user_id: string;
  completion_date: string;
  completed: boolean;
};

const HABIT_COLUMNS = 'id, couple_id, owner_user_id, title, owner_scope, sort_order, created_at, habit_kind, reminder_hour';

// all of the caller's habits, solo + shared (rls filters the rest)
export async function fetchHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select(HABIT_COLUMNS)
    .is('archived_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as Habit[]) ?? [];
}

// who's checked off what, for today only
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

// creates a habit, solo or shared depending on whether the caller is paired
export async function createHabit(
  title: string,
  coupleId: string | null,
  ownerScope: HabitOwnerScope = coupleId ? 'ours' : 'mine',
  completionPolicy: HabitCompletionPolicy = 'either',
  reminderHour: number | null = null
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
    reminder_hour: reminderHour,
  });
  if (error) throw error;
}

// the notify-habit-reminders edge function (real backend, runs hourly) reads this directly —
// setting it here is the only piece needed to make habit reminders actually fire
export async function setHabitReminderHour(habitId: string, reminderHour: number | null): Promise<void> {
  const { error } = await supabase.from('habits').update({ reminder_hour: reminderHour }).eq('id', habitId);
  if (error) throw error;
}

// flips today's completion for the caller — upsert so re-toggling just overwrites
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
