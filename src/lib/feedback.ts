import { supabase } from '@/lib/supabase';
import type { FunnelEventName } from '@/lib/database-types';

// both tables are insert-only from the client (no select policy) — write and forget

export async function submitFeedback(kind: 'feedback' | 'bug_report', message: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { error } = await supabase.from('user_feedback').insert({ user_id: userId, kind, message });
  if (error) throw error;
}

export async function logFunnelEvent(eventName: FunnelEventName, properties?: Record<string, unknown>): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return; // analytics only — never block on a missing session

  await supabase.from('funnel_events').insert({
    user_id: userId,
    event_name: eventName,
    properties: properties ?? {},
    environment: __DEV__ ? 'development' : 'production',
  });
}
