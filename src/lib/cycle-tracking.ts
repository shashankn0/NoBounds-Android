import { supabase } from '@/lib/supabase';
import type {
  CycleDailyEntry,
  CycleFlowLevel,
  CycleMood,
  CyclePeriodLog,
  CycleSharingPermissions,
  CycleSymptom,
  CycleSymptomSeverity,
  CycleSymptomType,
  CycleTrackingProfile,
} from '@/lib/database-types';

export const CYCLE_MOOD_LABEL: Record<CycleMood, string> = {
  happy: 'Happy',
  calm: 'Calm',
  anxious: 'Anxious',
  irritable: 'Irritable',
  sad: 'Sad',
  energetic: 'Energetic',
  tired: 'Tired',
};

export const CYCLE_FLOW_LABEL: Record<CycleFlowLevel, string> = { none: 'None', light: 'Light', medium: 'Medium', heavy: 'Heavy' };

export const CYCLE_SYMPTOM_LABEL: Record<CycleSymptomType, string> = {
  cramps: 'Cramps',
  headache: 'Headache',
  migraine: 'Migraine',
  bloating: 'Bloating',
  nausea: 'Nausea',
  back_pain: 'Back pain',
  breast_tenderness: 'Breast tenderness',
  fatigue: 'Fatigue',
};

export const CYCLE_SEVERITY_LABEL: Record<CycleSymptomSeverity, string> = { mild: 'Mild', moderate: 'Moderate', severe: 'Severe' };

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
  fertileWindowStart: Date | null;
  fertileWindowEnd: Date | null;
  predictedNextPeriodStart: Date | null;
  pmsWindowStart: Date | null;
  anchorPeriodStart: Date | null;
};

const DEFAULT_LUTEAL_PHASE_DAYS = 14;
const PMS_WINDOW_DAYS = 7;
const OVULATION_WINDOW_DAYS = 2;
const FERTILE_DAYS_BEFORE_OVULATION = 5;
const FERTILE_DAYS_AFTER_OVULATION = 1;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

// port of cyclephasecalculator.swift's snapshot(referenceDate:calendar:periodLogs:avgCycleLengthDays:avgPeriodLengthDays:)
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
    return {
      currentPhase: 'follicular',
      phaseProgress: 0,
      cycleDay: 1,
      fertileWindowStart: null,
      fertileWindowEnd: null,
      predictedNextPeriodStart: null,
      pmsWindowStart: null,
      anchorPeriodStart: null,
    };
  }

  const anchor = startOfDay(new Date(`${anchorRaw}T00:00:00`));
  const daysSinceStart = daysBetween(anchor, referenceDate);
  const cycleDay = (((daysSinceStart % cycleLength) + cycleLength) % cycleLength) + 1;

  const ovulationDay = Math.max(periodLength + 1, cycleLength - DEFAULT_LUTEAL_PHASE_DAYS);
  const ovulationStartDay = ovulationDay;
  const ovulationEndDay = Math.min(cycleLength, ovulationDay + OVULATION_WINDOW_DAYS - 1);

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

  const fertileStartDay = Math.max(periodLength + 1, ovulationDay - FERTILE_DAYS_BEFORE_OVULATION);
  const fertileEndDay = Math.min(cycleLength, ovulationDay + FERTILE_DAYS_AFTER_OVULATION);
  const fertileWindowStart = addDays(anchor, fertileStartDay - 1);
  const fertileWindowEnd = addDays(anchor, fertileEndDay - 1);

  const predictedNextPeriodStart = addDays(anchor, cycleLength);
  const pmsWindowStart = addDays(predictedNextPeriodStart, -PMS_WINDOW_DAYS);

  return {
    currentPhase,
    phaseProgress,
    cycleDay,
    fertileWindowStart,
    fertileWindowEnd,
    predictedNextPeriodStart,
    pmsWindowStart,
    anchorPeriodStart: anchor,
  };
}

// port of cyclephasecalculator.swift's averageCycleLength — gaps between consecutive logged
// starts, keeping only plausible (21-45 day) gaps; real history overrides the stored profile
// average once someone has logged at least two periods
export function averageCycleLength(periodLogs: CyclePeriodLog[]): number | null {
  if (periodLogs.length < 2) return null;
  const starts = periodLogs
    .map((log) => log.period_start_date)
    .sort()
    .map((raw) => startOfDay(new Date(`${raw}T00:00:00`)));

  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const gap = daysBetween(starts[i - 1], starts[i]);
    if (gap >= 21 && gap <= 45) gaps.push(gap);
  }
  if (gaps.length === 0) return null;
  return Math.round(gaps.reduce((sum, g) => sum + g, 0) / gaps.length);
}

// port of cyclephasecalculator.swift's projectedPeriodStarts — anchor itself is NOT included,
// capped at 24 cycles forward, stops once past endDate
export function projectedPeriodStarts(anchor: Date, cycleLengthDays: number, endDate: Date): Date[] {
  const results: Date[] = [];
  let current = startOfDay(anchor);
  for (let i = 0; i < 24; i++) {
    current = addDays(current, cycleLengthDays);
    if (current > startOfDay(endDate)) break;
    results.push(current);
  }
  return results;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// port of features/cycletracking/components/cyclecalendarmonthmodel.swift's CycleCalendarDayStyler
export type CycleCalendarDayStyler = {
  isPeriodDay: (date: Date) => boolean;
  isPredictedPeriodDay: (date: Date) => boolean;
  isFertileDay: (date: Date) => boolean;
  hasPredictions: boolean;
};

export function buildCalendarDayStyler(
  periodLogs: CyclePeriodLog[],
  snapshot: CyclePhaseSnapshot,
  rangeEnd: Date,
  showFlowDetails: boolean
): CycleCalendarDayStyler {
  const periodRanges = periodLogs.map((log) => {
    const start = startOfDay(new Date(`${log.period_start_date}T00:00:00`));
    const length = log.period_length_days ?? 5;
    return { start, end: addDays(start, length - 1) };
  });

  const showPeriod = showFlowDetails || periodLogs.length > 0;

  function isPeriodDay(date: Date): boolean {
    if (!showPeriod) return false;
    const day = startOfDay(date);
    return periodRanges.some((r) => day >= r.start && day <= r.end);
  }

  let predictedRanges: { start: Date; end: Date }[] = [];
  if (snapshot.anchorPeriodStart && snapshot.predictedNextPeriodStart) {
    const cycleLength = daysBetween(snapshot.anchorPeriodStart, snapshot.predictedNextPeriodStart);
    const mostRecent = [...periodLogs].sort((a, b) => (a.period_start_date < b.period_start_date ? 1 : -1))[0];
    const predictedLength = mostRecent?.period_length_days ?? 5;
    const starts = projectedPeriodStarts(snapshot.anchorPeriodStart, cycleLength, rangeEnd);
    predictedRanges = starts.map((start) => ({ start, end: addDays(start, predictedLength - 1) }));
  }

  function isPredictedPeriodDay(date: Date): boolean {
    const day = startOfDay(date);
    return predictedRanges.some((r) => day >= r.start && day <= r.end);
  }

  function isFertileDay(date: Date): boolean {
    if (!snapshot.fertileWindowStart || !snapshot.fertileWindowEnd) return false;
    const day = startOfDay(date);
    return day >= snapshot.fertileWindowStart && day <= snapshot.fertileWindowEnd;
  }

  return { isPeriodDay, isPredictedPeriodDay, isFertileDay, hasPredictions: predictedRanges.length > 0 };
}

// port of cyclecalendarmonthmodel.swift's rolling window + grid layout
export const CYCLE_CALENDAR_MONTHS_BACK = 6;
export const CYCLE_CALENDAR_MONTHS_FORWARD = 6;
export const CYCLE_CALENDAR_WEEKDAY_SYMBOLS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function cycleCalendarMonthStart(offsetFromCurrent: number, referenceDate: Date = new Date()): Date {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth() + offsetFromCurrent, 1);
}

export function cycleCalendarGridDays(monthStart: Date): (Date | null)[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
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

export async function fetchDailyEntry(entryDate: string): Promise<CycleDailyEntry | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('cycle_daily_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_date', entryDate)
    .maybeSingle();
  if (error) throw error;
  return data as CycleDailyEntry | null;
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

// partner reads: RLS's cycle_partner_can_view() gate handles visibility server-side — these
// plain selects just come back empty when the partner hasn't shared that data, no client-side
// permission check needed to avoid an error
export async function fetchPartnerProfile(partnerUserId: string): Promise<CycleTrackingProfile | null> {
  const { data, error } = await supabase.from('cycle_tracking_profiles').select('*').eq('user_id', partnerUserId).maybeSingle();
  if (error) throw error;
  return data as CycleTrackingProfile | null;
}

export async function fetchPartnerSharingPermissions(partnerUserId: string): Promise<CycleSharingPermissions | null> {
  const { data, error } = await supabase.from('cycle_sharing_permissions').select('*').eq('user_id', partnerUserId).maybeSingle();
  if (error) throw error;
  return data as CycleSharingPermissions | null;
}

export async function fetchPartnerPeriodLogs(partnerUserId: string): Promise<CyclePeriodLog[]> {
  const { data, error } = await supabase
    .from('cycle_period_logs')
    .select('*')
    .eq('user_id', partnerUserId)
    .order('period_start_date', { ascending: false });
  if (error) throw error;
  return (data as CyclePeriodLog[]) ?? [];
}

export async function fetchPartnerDailyEntries(partnerUserId: string, sinceDate: string): Promise<CycleDailyEntry[]> {
  const { data, error } = await supabase
    .from('cycle_daily_entries')
    .select('*')
    .eq('user_id', partnerUserId)
    .gte('entry_date', sinceDate)
    .order('entry_date', { ascending: false });
  if (error) throw error;
  return (data as CycleDailyEntry[]) ?? [];
}

export function isProfileActivelySharing(profile: CycleTrackingProfile | null): boolean {
  return !!profile && profile.sharing_enabled && profile.unlinked_at === null;
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

// mirrors instant_unlink_cycle_sharing() rpc: stops sharing, wipes permission flags, keeps
// historical logs and the couple connection intact
export async function instantUnlinkCycleSharing(): Promise<void> {
  const { error } = await supabase.rpc('instant_unlink_cycle_sharing');
  if (error) throw error;
}
