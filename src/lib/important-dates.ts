import { supabase } from '@/lib/supabase';
import type { ImportantDate } from '@/lib/database-types';

// solo (couple_id null) until pairing merges it — same pattern as habits/timeline_memories
export async function fetchImportantDates(): Promise<ImportantDate[]> {
  const { data, error } = await supabase.from('important_dates').select('*').order('event_date', { ascending: true });
  if (error) throw error;
  return (data as ImportantDate[]) ?? [];
}

export async function createImportantDate(
  title: string,
  eventDate: string,
  coupleId: string | null,
  description?: string,
  repeatsYearly = false
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const ownerUserId = userData.user?.id;
  if (!ownerUserId) throw new Error('Not signed in');

  const { error } = await supabase.from('important_dates').insert({
    title,
    event_date: eventDate,
    couple_id: coupleId,
    owner_user_id: ownerUserId,
    description: description ?? null,
    repeats_yearly: repeatsYearly,
  });
  if (error) throw error;
}
