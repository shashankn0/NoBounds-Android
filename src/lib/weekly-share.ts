import { supabase } from '@/lib/supabase';
import type { CoupleWeeklyShare, WeeklyShareKind, WeeklyShareQuote } from '@/lib/database-types';

// mirrors weeklysharemodels.swift's WeeklyShareWeek.currentWeekStartKey: the MONDAY (not
// Sunday) starting the current local week, formatted from local date components (not
// toISOString, which converts to UTC first and can land on the wrong calendar day near
// midnight in any timezone west of UTC) — both must match exactly or the two platforms
// look up different week rows for what should be "this week"
export function currentWeekStartKey(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const date = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

// one share per couple per week — null if nobody's posted one yet this week
export async function fetchThisWeeksShare(coupleId: string): Promise<CoupleWeeklyShare | null> {
  const { data, error } = await supabase
    .from('couple_weekly_shares')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('week_start', currentWeekStartKey())
    .maybeSingle();
  if (error) throw error;
  return data as CoupleWeeklyShare | null;
}

// mirrors createweeklysharesheet.swift's normalizedURL: accepts bare domains by assuming
// https, and requires a plausible (dotted) host so obvious typos don't get saved
export function normalizedWeeklyShareUrl(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

// replaces whatever the couple has featured this week — matches ios's upsertShare
// (onConflict couple_id,week_start, enforced by a real unique constraint on that pair)
export async function upsertWeeklyShare(
  coupleId: string,
  kind: WeeklyShareKind,
  body: string,
  url: string | null
): Promise<CoupleWeeklyShare> {
  const { data: userData } = await supabase.auth.getUser();
  const createdBy = userData.user?.id;
  if (!createdBy) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('couple_weekly_shares')
    .upsert(
      { couple_id: coupleId, created_by: createdBy, week_start: currentWeekStartKey(), kind, body, url: kind === 'link' ? url : null },
      { onConflict: 'couple_id,week_start' }
    )
    .select('*')
    .single();
  if (error) throw error;
  return data as CoupleWeeklyShare;
}

export async function deleteWeeklyShare(id: string): Promise<void> {
  const { error } = await supabase.from('couple_weekly_shares').delete().eq('id', id);
  if (error) throw error;
}

// curated fallback quotes shown on the home card when nobody's shared anything this week
export async function fetchWeeklyShareQuotes(): Promise<WeeklyShareQuote[]> {
  const { data, error } = await supabase
    .from('weekly_share_quotes')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as WeeklyShareQuote[]) ?? [];
}

// 64-bit FNV-1a — must byte-for-byte match ios's WeeklyShareDefaultQuotePicker.stableHash so
// both partners land on the exact same "quotes[seed % count]" pick, not just each their own
// internally-consistent one. Uses BigInt because JS numbers can't hold a full 64-bit hash.
const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

function stableHash(text: string): bigint {
  let hash = FNV_OFFSET_BASIS;
  const bytes = new TextEncoder().encode(text);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & UINT64_MASK;
  }
  return hash;
}

// deterministic by couple+week so both partners see the same quote until someone shares their
// own, and it rotates as the week changes — mirrors ios's WeeklyShareDefaultQuotePicker exactly
export function pickWeeklyShareQuote(quotes: WeeklyShareQuote[], coupleId: string, weekStartKey: string): WeeklyShareQuote | null {
  if (quotes.length === 0) return null;
  const seed = stableHash(`${coupleId.toLowerCase()}:${weekStartKey}`);
  const index = Number(seed % BigInt(quotes.length));
  return quotes[index];
}
