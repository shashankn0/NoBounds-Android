import { supabase } from '@/lib/supabase';

export type ReunionStatus =
  | { kind: 'noDateSet' }
  | { kind: 'daysUntil'; days: number }
  | { kind: 'today' }
  | { kind: 'together'; dayNumber: number }
  | { kind: 'past' };

// day-number helper: Date.UTC of a y/m/d triple is only ever used as a stable, DST-proof 24h
// grid to diff calendar days — it never represents a real UTC instant. reunion_start_date /
// reunion_end_date are plain local calendar-day strings (like habits' dateKey), so "today" must
// come from the device's LOCAL date fields too. this used to read getUTCFullYear/etc instead,
// which compared "today" as its UTC calendar day against dates meant as local calendar days —
// the same bug class Shaan's CycleDateCodec fix addressed on iOS. in any negative-UTC-offset
// timezone (all of the US) that flipped the countdown a day early every evening, since e.g. 9pm
// PST is already tomorrow in UTC.
function dayNumber(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function dayNumberFromDateOnly(dateOnly: string): number {
  const [y, m, d] = dateOnly.split('-').map(Number);
  return dayNumber(y, m, d);
}

function dayNumberFromLocalInstant(date: Date): number {
  return dayNumber(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function reunionStatus(startDate: string | null, endDate: string | null, now: Date = new Date()): ReunionStatus {
  if (!startDate) return { kind: 'noDateSet' };

  const today = dayNumberFromLocalInstant(now);
  const start = dayNumberFromDateOnly(startDate);

  if (endDate) {
    const end = dayNumberFromDateOnly(endDate);
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

// the header popover, settings and the calendar all read couples.reunion_*; editors notify here so
// anything already on screen (like the calendar's reunion highlight) refreshes right away
const reunionListeners = new Set<() => void>();

export function subscribeReunionChanges(listener: () => void): () => void {
  reunionListeners.add(listener);
  return () => {
    reunionListeners.delete(listener);
  };
}

// mirrors ReunionCountdownCalculator.isReunionDay: inside the range when there's an end date,
// otherwise only the start day. dateKey is a local yyyy-mm-dd, compared as a plain string
export function isReunionDay(dateKey: string, startDate: string | null, endDate: string | null): boolean {
  if (!startDate) return false;
  if (endDate) return dateKey >= startDate && dateKey <= endDate;
  return dateKey === startDate;
}

export async function updateReunionDates(coupleId: string, startDate: string | null, endDate: string | null): Promise<void> {
  const { error } = await supabase
    .from('couples')
    .update({ reunion_start_date: startDate, reunion_end_date: endDate, updated_at: new Date().toISOString() })
    .eq('id', coupleId);
  if (error) throw error;
  reunionListeners.forEach((listener) => listener());
}
