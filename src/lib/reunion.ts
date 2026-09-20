import { supabase } from '@/lib/supabase';

export type ReunionStatus =
  | { kind: 'noDateSet' }
  | { kind: 'daysUntil'; days: number }
  | { kind: 'today' }
  | { kind: 'together'; dayNumber: number }
  | { kind: 'past' };

// mirrors reunioncountdowncalculator.swift — both the stored dates and "today" are compared as
// utc-midnight day numbers, not local time, so partners in different timezones see the same countdown
function utcDayNumber(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function utcDayFromDateOnly(dateOnly: string): number {
  const [y, m, d] = dateOnly.split('-').map(Number);
  return utcDayNumber(y, m, d);
}

function utcDayFromInstant(date: Date): number {
  return utcDayNumber(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function reunionStatus(startDate: string | null, endDate: string | null, now: Date = new Date()): ReunionStatus {
  if (!startDate) return { kind: 'noDateSet' };

  const today = utcDayFromInstant(now);
  const start = utcDayFromDateOnly(startDate);

  if (endDate) {
    const end = utcDayFromDateOnly(endDate);
    if (today >= start && today <= end) {
      return { kind: 'together', dayNumber: today - start + 1 };
    }
  }

  const daysUntil = start - today;
  if (daysUntil > 0) return { kind: 'daysUntil', days: daysUntil };
  if (daysUntil === 0) return { kind: 'today' };
  return { kind: 'past' };
}

export function formatReunionDateRange(startDate: string, endDate: string | null): string {
  const format = (dateOnly: string) =>
    new Date(`${dateOnly}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return endDate ? `${format(startDate)} – ${format(endDate)}` : format(startDate);
}

export async function fetchReunionDates(coupleId: string): Promise<{ startDate: string | null; endDate: string | null }> {
  const { data, error } = await supabase.from('couples').select('reunion_start_date, reunion_end_date').eq('id', coupleId).maybeSingle();
  if (error) throw error;
  const row = data as { reunion_start_date: string | null; reunion_end_date: string | null } | null;
  return { startDate: row?.reunion_start_date ?? null, endDate: row?.reunion_end_date ?? null };
}

export async function updateReunionDates(coupleId: string, startDate: string | null, endDate: string | null): Promise<void> {
  const { error } = await supabase
    .from('couples')
    .update({ reunion_start_date: startDate, reunion_end_date: endDate, updated_at: new Date().toISOString() })
    .eq('id', coupleId);
  if (error) throw error;
}
