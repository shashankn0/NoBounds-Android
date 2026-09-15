import { supabase } from '@/lib/supabase';
import type {
  CycleDailyEntry,
  CycleFlowLevel,
  CycleMood,
  CyclePeriodLog,
  CycleSharingPermissions,
  CycleSymptom,
  CycleTrackingProfile,
} from '@/lib/database-types';

export async function fetchPeriodLogs(): Promise<CyclePeriodLog[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('cycle_period_logs')
    .select('*')
    .eq('user_id', userId)
    .order('period_start_date', { ascending: false });
  if (error) throw error;
  return (data as CyclePeriodLog[]) ?? [];
}

// port of core/domain/cycletracking/cyclephasecalculator.swift — same day-range math, client-only
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
export const CYCLE_PHASES: CyclePhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];
export const CYCLE_PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
};

export type CyclePhaseSnapshot = {
  currentPhase: CyclePhase;
  phaseProgress: number;
  cycleDay: number;
};

const DEFAULT_LUTEAL_PHASE_DAYS = 14;

export function calculateCyclePhase(
  referenceDate: Date,
  periodLogs: CyclePeriodLog[],
  avgCycleLengthDays: number,
  avgPeriodLengthDays: number
): CyclePhaseSnapshot {
  const anchorRaw = periodLogs
    .map((log) => log.period_start_date)
    .sort()
    .at(-1);
  const cycleLength = Math.max(21, avgCycleLengthDays);
  const periodLength = Math.max(2, Math.min(avgPeriodLengthDays, cycleLength - 1));

  if (!anchorRaw) {
    return { currentPhase: 'follicular', phaseProgress: 0, cycleDay: 1 };
  }

  const anchor = new Date(`${anchorRaw}T00:00:00`);
  const startOfReference = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const startOfAnchor = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const daysSinceStart = Math.round((startOfReference.getTime() - startOfAnchor.getTime()) / 86400000);
  const cycleDay = (((daysSinceStart % cycleLength) + cycleLength) % cycleLength) + 1;

  const ovulationDay = Math.max(periodLength + 1, cycleLength - DEFAULT_LUTEAL_PHASE_DAYS);
  const ovulationStartDay = ovulationDay;
  const ovulationEndDay = Math.min(cycleLength, ovulationDay + 2 - 1);

  let currentPhase: CyclePhase;
  if (cycleDay <= periodLength) currentPhase = 'menstrual';
  else if (cycleDay < ovulationStartDay) currentPhase = 'follicular';
  else if (cycleDay <= ovulationEndDay) currentPhase = 'ovulation';
  else currentPhase = 'luteal';

  let phaseProgress: number;
  if (currentPhase === 'menstrual') {
    phaseProgress = clamp01(cycleDay / Math.max(1, periodLength));
  } else if (currentPhase === 'follicular') {
    const length = Math.max(1, ovulationStartDay - periodLength - 1);
    phaseProgress = clamp01((cycleDay - periodLength) / length);
  } else if (currentPhase === 'ovulation') {
    const length = Math.max(1, ovulationEndDay - ovulationStartDay + 1);
    phaseProgress = clamp01((cycleDay - ovulationStartDay + 1) / length);
  } else {
    const lutealStart = ovulationEndDay + 1;
    const length = Math.max(1, cycleLength - ovulationEndDay);
    phaseProgress = clamp01((cycleDay - lutealStart + 1) / length);
  }

  return { currentPhase, phaseProgress, cycleDay };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// null if the caller has never opted in
export async function fetchCycleProfile(): Promise<CycleTrackingProfile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data, error } = await supabase.from('cycle_tracking_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as CycleTrackingProfile | null;
}

export async function fetchSharingPermissions(): Promise<CycleSharingPermissions | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data, error } = await supabase.from('cycle_sharing_permissions').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as CycleSharingPermissions | null;
}

export async function fetchDailyEntries(sinceDate: string): Promise<CycleDailyEntry[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('cycle_daily_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('entry_date', sinceDate)
    .order('entry_date', { ascending: false });
  if (error) throw error;
  return (data as CycleDailyEntry[]) ?? [];
}

export async function logPeriodStart(coupleId: string, periodStartDate: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { error } = await supabase
    .from('cycle_period_logs')
    .upsert(
      { user_id: userId, couple_id: coupleId, period_start_date: periodStartDate } satisfies Partial<CyclePeriodLog>,
      { onConflict: 'user_id,period_start_date' }
    );
  if (error) throw error;
}

// upserts today's (or any day's) mood/flow/symptoms together — pass only what changed,
// undefined fields are left out of the write entirely so they don't overwrite existing values
export async function logDailyEntry(
  coupleId: string,
  entryDate: string,
  fields: { mood?: CycleMood | null; flowLevel?: CycleFlowLevel | null; symptoms?: CycleSymptom[] }
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data: existing } = await supabase
    .from('cycle_daily_entries')
    .select('mood, flow_level, symptoms')
    .eq('user_id', userId)
    .eq('entry_date', entryDate)
    .maybeSingle();

  const row = existing as { mood: CycleMood | null; flow_level: CycleFlowLevel | null; symptoms: CycleSymptom[] } | null;

  const { error } = await supabase.from('cycle_daily_entries').upsert(
    {
      user_id: userId,
      couple_id: coupleId,
      entry_date: entryDate,
      mood: fields.mood !== undefined ? fields.mood : (row?.mood ?? null),
      flow_level: fields.flowLevel !== undefined ? fields.flowLevel : (row?.flow_level ?? null),
      symptoms: fields.symptoms !== undefined ? fields.symptoms : (row?.symptoms ?? []),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,entry_date' }
  );
  if (error) throw error;
}

// one row per user, created alongside cycle_tracking_profiles — upsert covers both first-time
// creation (all false, the table's own defaults) and later toggles
export async function upsertSharingPermissions(permissions: Partial<Omit<CycleSharingPermissions, 'user_id' | 'updated_at'>>): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { error } = await supabase
    .from('cycle_sharing_permissions')
    .upsert({ user_id: userId, ...permissions, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}
