import { supabase } from '@/lib/supabase';

export type HabitOwnerScope = 'mine' | 'yours' | 'ours';
export type HabitCompletionPolicy = 'either' | 'both';
export type HabitKind = 'standard' | 'weeks_bound' | 'bound_streak';

// a habit — solo (couple_id null) until pairing merges it into the couple
export type Habit = {
  id: string;
  couple_id: string | null;
  owner_user_id: string;
  title: string;
  owner_scope: HabitOwnerScope;
  completion_policy: HabitCompletionPolicy;
  sort_order: number;
  created_at: string;
  habit_kind: HabitKind;
  reminder_hour: number | null;
};

// one user's check-in for one habit on one day
export type HabitCompletion = {
  habit_id: string;
  user_id: string;
  completion_date: string;
  completed: boolean;
};

const HABIT_COLUMNS =
  'id, couple_id, owner_user_id, title, owner_scope, completion_policy, sort_order, created_at, habit_kind, reminder_hour';

// the caller's active habits, scoped exactly like ios's HabitsRepository.fetchActiveHabits: paired
// users see only the couple's habits, solo users only their own couple_id-null ones. rls alone
// returns both, and pairing leaves the pre-pairing solo system habits behind — unscoped, that
// showed "Week's Bound" twice on Sundays (once solo, once couple)
export async function fetchHabits(knownCoupleId?: string | null): Promise<Habit[]> {
  // getSession reads the local session (getUser is a network round trip)
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('Not signed in');

  // callers that already know the couple (the session context) skip the membership lookup
  let coupleId: string | null;
  if (knownCoupleId !== undefined) {
    coupleId = knownCoupleId;
  } else {
    const { data: membership, error: membershipError } = await supabase.from('couple_members').select('couple_id').limit(1);
    if (membershipError) throw membershipError;
    coupleId = (membership as { couple_id: string }[] | null)?.[0]?.couple_id ?? null;
  }

  let query = supabase.from('habits').select(HABIT_COLUMNS).is('archived_at', null);
  query = coupleId ? query.eq('couple_id', coupleId) : query.is('couple_id', null).eq('owner_user_id', userId);

  const { data, error } = await query.order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as Habit[]) ?? [];
}

// who's checked off what, for today only
export async function fetchTodaysCompletions(): Promise<HabitCompletion[]> {
  const today = todayKey();
  const { data, error } = await supabase
    .from('habit_completions')
    .select('habit_id, user_id, completion_date, completed')
    .eq('completion_date', today);
  if (error) throw error;
  return (data as HabitCompletion[]) ?? [];
}

// completions across a date range (inclusive) — needed to compute streaks, which look
// backwards day by day (or week by week for weeks_bound) until an unsatisfied day breaks it
export async function fetchCompletionsInRange(habitIds: string[], fromDate: string, toDate: string): Promise<HabitCompletion[]> {
  if (habitIds.length === 0) return [];
  const { data, error } = await supabase
    .from('habit_completions')
    .select('habit_id, user_id, completion_date, completed')
    .in('habit_id', habitIds)
    .gte('completion_date', fromDate)
    .lte('completion_date', toDate);
  if (error) throw error;
  return (data as HabitCompletion[]) ?? [];
}

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

// sets the caller's completion for a specific day — upsert so re-toggling just overwrites.
// the calendar's day-detail sheet lets you check off a past day, not just today, mirroring
// ios's CalendarViewModel.toggleCompletion(habitID:date:completed:)
export async function setHabitCompletion(habitId: string, date: string, completed: boolean): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { error } = await supabase
    .from('habit_completions')
    .upsert(
      { habit_id: habitId, user_id: userId, completion_date: date, completed, updated_at: new Date().toISOString() },
      { onConflict: 'habit_id,user_id,completion_date' }
    );
  if (error) throw error;
}

// flips today's completion for the caller
export async function toggleHabitToday(habitId: string, completed: boolean): Promise<void> {
  return setHabitCompletion(habitId, todayKey(), completed);
}

// edits a standard (user-created) habit's title/scope/policy — system habits (weeks_bound,
// bound_streak) are never editable, matching ios's HabitDetailView.canManage
export async function updateHabit(
  habitId: string,
  title: string,
  ownerScope: HabitOwnerScope,
  completionPolicy: HabitCompletionPolicy
): Promise<void> {
  const { error } = await supabase
    .from('habits')
    .update({ title, owner_scope: ownerScope, completion_policy: completionPolicy })
    .eq('id', habitId);
  if (error) throw error;
}

// soft-deletes a habit — past completions are kept, matching ios's confirmation copy exactly
export async function archiveHabit(habitId: string): Promise<void> {
  const { error } = await supabase.from('habits').update({ archived_at: new Date().toISOString() }).eq('id', habitId);
  if (error) throw error;
}

export function todayKey(date: Date = new Date()): string {
  return dateKey(date);
}

// yyyy-mm-dd in local time — mirrors ios's HabitDateParser (Calendar.current components, not UTC)
export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// mirrors ios's HabitSchedule.applies — weeks_bound is a once-a-week ritual, only relevant on
// the day it resets (Sunday); standard and bound_streak habits are daily
export function habitAppliesOn(habit: Habit, date: Date): boolean {
  if (habit.habit_kind === 'weeks_bound') {
    return date.getDay() === 0;
  }
  return true;
}

export type HabitDayStatus = {
  habit: Habit;
  dateKey: string;
  isSatisfied: boolean;
  myCompleted: boolean;
  partnerCompleted: boolean;
  canToggle: boolean;
  isPartiallyComplete: boolean;
  statusLabel: string;
};

// system habits (weeks_bound, bound_streak) complete via their linked flows — the Bound camera,
// a weekly photo post — never by tapping the row like a normal checkbox
export function canToggleHabit(habit: Habit, currentUserId: string, partnerId: string | null): boolean {
  if (habit.habit_kind === 'weeks_bound' || habit.habit_kind === 'bound_streak') return false;

  switch (habit.owner_scope) {
    case 'mine':
      return habit.owner_user_id === currentUserId;
    case 'yours':
      return partnerId != null && habit.owner_user_id !== currentUserId;
    case 'ours':
      return true;
  }
}

// mirrors ios's HabitCompletionResolver.resolveDayStatus exactly, including the boundStreak/
// weeksBound status copy — this is what actually makes "ours"/"both required" habits reflect
// the partner's check-in instead of only ever looking at your own completion row
export function resolveDayStatus(
  habit: Habit,
  dateKeyForDay: string,
  completions: HabitCompletion[],
  currentUserId: string,
  partnerId: string | null
): HabitDayStatus {
  const dayCompletions = completions.filter((c) => c.habit_id === habit.id && c.completion_date === dateKeyForDay);

  const myCompleted = dayCompletions.some((c) => c.user_id === currentUserId && c.completed);
  const ownerCompleted = dayCompletions.some((c) => c.user_id === habit.owner_user_id && c.completed);
  const partnerCompleted = partnerId != null && dayCompletions.some((c) => c.user_id === partnerId && c.completed);
  const assigneeCompleted = dayCompletions.some((c) => c.user_id !== habit.owner_user_id && c.completed);

  let isSatisfied: boolean;
  switch (habit.owner_scope) {
    case 'mine':
      isSatisfied = ownerCompleted;
      break;
    case 'yours':
      isSatisfied = partnerId != null && assigneeCompleted;
      break;
    case 'ours':
      isSatisfied =
        habit.completion_policy === 'either'
          ? myCompleted || partnerCompleted
          : partnerId == null
            ? myCompleted
            : myCompleted && partnerCompleted;
      break;
  }

  const canToggle = canToggleHabit(habit, currentUserId, partnerId);
  const isPartiallyComplete =
    habit.owner_scope === 'ours' && habit.completion_policy === 'both' && !isSatisfied && myCompleted !== partnerCompleted;

  const statusLabel = habitStatusLabel(habit, { isSatisfied, myCompleted, assigneeCompleted, partnerCompleted, canToggle, partnerId });

  return {
    habit,
    dateKey: dateKeyForDay,
    isSatisfied,
    myCompleted,
    partnerCompleted,
    canToggle,
    isPartiallyComplete,
    statusLabel,
  };
}

function habitStatusLabel(
  habit: Habit,
  args: {
    isSatisfied: boolean;
    myCompleted: boolean;
    assigneeCompleted: boolean;
    partnerCompleted: boolean;
    canToggle: boolean;
    partnerId: string | null;
  }
): string {
  const { isSatisfied, myCompleted, assigneeCompleted, partnerCompleted, canToggle, partnerId } = args;

  if (habit.habit_kind === 'weeks_bound') {
    return isSatisfied ? 'Posted this week' : 'Add 1–10 photos from your week';
  }

  if (habit.habit_kind === 'bound_streak') {
    if (isSatisfied) return 'Bounds exchanged today';
    if (myCompleted && !partnerCompleted) return "Waiting on partner's Bound";
    if (partnerCompleted && !myCompleted) return 'Send a Bound to keep the streak';
    return 'Both of you send a Bound today';
  }

  if (isSatisfied) {
    return habit.owner_scope === 'ours' ? 'Done together' : 'Done';
  }

  switch (habit.owner_scope) {
    case 'mine':
      return canToggle ? 'Your turn' : 'Waiting on partner';
    case 'yours':
      if (canToggle) return myCompleted ? 'Done' : 'Your turn';
      return assigneeCompleted ? 'Partner done' : 'Waiting on partner';
    case 'ours':
      if (habit.completion_policy === 'either') {
        return myCompleted || partnerCompleted ? 'One of you checked in' : 'Either of you can check in';
      }
      if (myCompleted && !partnerCompleted) return 'Waiting on partner';
      if (partnerCompleted && !myCompleted) return 'Your turn';
      return partnerId == null ? 'Your turn' : 'Both of you';
  }
}

// builds today's status for every habit that applies today, mirroring ios's
// HabitsRepository.dayStatuses (habits + habitAppliesOn filter + resolveDayStatus map)
export function todaysDayStatuses(
  habits: Habit[],
  completions: HabitCompletion[],
  currentUserId: string,
  partnerId: string | null,
  today: Date = new Date()
): HabitDayStatus[] {
  const key = dateKey(today);
  return habits.filter((h) => habitAppliesOn(h, today)).map((h) => resolveDayStatus(h, key, completions, currentUserId, partnerId));
}

// mirrors ios's HabitStreakCalculator — walks backward (daily for standard/bound_streak,
// weekly by Sunday for weeks_bound) counting consecutive satisfied days/weeks until one breaks
export function currentStreak(
  habit: Habit,
  completions: HabitCompletion[],
  currentUserId: string,
  partnerId: string | null,
  endingAt: Date = new Date()
): number {
  if (habit.habit_kind === 'weeks_bound') {
    return weeklyStreak(habit, completions, currentUserId, partnerId, endingAt);
  }
  return dailyStreak(habit, completions, currentUserId, partnerId, endingAt);
}

function dailyStreak(habit: Habit, completions: HabitCompletion[], currentUserId: string, partnerId: string | null, endingAt: Date): number {
  let streak = 0;
  const cursor = new Date(endingAt);
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const status = resolveDayStatus(habit, dateKey(cursor), completions, currentUserId, partnerId);
    if (!status.isSatisfied) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function weeklyStreak(habit: Habit, completions: HabitCompletion[], currentUserId: string, partnerId: string | null, endingAt: Date): number {
  let streak = 0;
  const cursor = mostRecentSunday(endingAt);

  while (true) {
    const status = resolveDayStatus(habit, dateKey(cursor), completions, currentUserId, partnerId);
    if (!status.isSatisfied) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

function mostRecentSunday(date: Date): Date {
  const cursor = new Date(date);
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getDay() !== 0) {
    cursor.setDate(cursor.getDate() - 1);
  }
  return cursor;
}
