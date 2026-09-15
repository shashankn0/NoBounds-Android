import { supabase } from '@/lib/supabase';
import type { CoupleWeeklyShare } from '@/lib/database-types';

// one share per couple per week — null if nobody's posted one yet this week
export async function fetchThisWeeksShare(coupleId: string): Promise<CoupleWeeklyShare | null> {
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const weekStart = startOfWeek.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('couple_weekly_shares')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (error) throw error;
  return data as CoupleWeeklyShare | null;
}
