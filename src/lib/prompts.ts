import { getSignedUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { PromptMessage, PromptMessageKind, PromptTemplate } from '@/lib/database-types';

// the "Chat" tab. verified against the live production schema (not the older migrations in the
// ios repo): chat is one flat, couple-scoped stream in public.prompt_messages, where `kind` is
// 'text' (normal message), 'prompt' (a question someone sent — rendered as a centered system
// bubble) or 'photo_reply' (a reply to a Bound photo). the old couple_daily_prompts /
// prompt_answers / prompt_reactions / prompt_replies tables no longer exist.

export const CHAT_PAGE_SIZE = 40;

// isWeekly marks the couple's current weekly prompt (not a prompt_messages row) so the UI can
// show it without an "Asked by" line, like ios
export type ChatMessage = PromptMessage & { photoUrl: string | null; isWeekly?: boolean };

type EnsureWeeklyResponse = { couple_weekly_prompt_id: string; couple_id: string; body: string };

// server creates this week's row if missing; rate limited to 60/h, so only call on load/refresh
export async function fetchWeeklyPrompt(coupleId: string): Promise<ChatMessage | null> {
  const { data, error } = await supabase.functions.invoke('ensure-weekly-prompt');
  if (error || !data) return null;
  const row = data as EnsureWeeklyResponse;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return {
    id: `weekly-${row.couple_weekly_prompt_id}`,
    couple_id: coupleId,
    user_id: '',
    body: row.body,
    kind: 'prompt',
    photo_id: null,
    created_at: startOfToday.toISOString(),
    photoUrl: null,
    isWeekly: true,
  };
}

// newest-first page, optionally older than a cursor; caller reverses for display
export async function fetchChatPage(coupleId: string, beforeCreatedAt?: string): Promise<ChatMessage[]> {
  let query = supabase.from('prompt_messages').select('*').eq('couple_id', coupleId);
  if (beforeCreatedAt) query = query.lt('created_at', beforeCreatedAt);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(CHAT_PAGE_SIZE);
  if (error) throw error;
  const rows = (data as PromptMessage[]) ?? [];
  return attachPhotos(rows);
}

async function attachPhotos(rows: PromptMessage[]): Promise<ChatMessage[]> {
  const photoIds = Array.from(new Set(rows.map((r) => r.photo_id).filter((id): id is string => !!id)));
  const urlByPhotoId: Record<string, string> = {};

  if (photoIds.length > 0) {
    const { data } = await supabase.from('presence_photos').select('id, storage_path').in('id', photoIds);
    const photos = (data as { id: string; storage_path: string }[] | null) ?? [];
    const urls = await Promise.all(photos.map((p) => getSignedUrl('presence', p.storage_path)));
    photos.forEach((p, i) => {
      if (urls[i]) urlByPhotoId[p.id] = urls[i] as string;
    });
  }

  return rows.map((row) => ({ ...row, photoUrl: row.photo_id ? (urlByPhotoId[row.photo_id] ?? null) : null }));
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

async function insertMessage(coupleId: string, body: string, kind: PromptMessageKind): Promise<PromptMessage> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('prompt_messages')
    .insert({ couple_id: coupleId, user_id: userId, body, kind, photo_id: null })
    .select()
    .single();
  if (error) throw error;
  return data as PromptMessage;
}

export function sendMessage(coupleId: string, body: string): Promise<PromptMessage> {
  return insertMessage(coupleId, body, 'text');
}

// "send a prompt" from the + sheet — same table, just kind = 'prompt'
export function sendPrompt(coupleId: string, body: string): Promise<PromptMessage> {
  return insertMessage(coupleId, body, 'prompt');
}

export async function fetchPromptTemplates(): Promise<PromptTemplate[]> {
  const { data, error } = await supabase.from('prompt_templates').select('*').eq('active', true).order('created_at', { ascending: true });
  if (error) throw error;
  return (data as PromptTemplate[]) ?? [];
}

// local yyyy-mm-dd for grouping the feed into days
export function localDateKey(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}
