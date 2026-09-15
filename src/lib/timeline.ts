import { supabase } from '@/lib/supabase';

// real backend has a 5th type, 'gratitude' (solo_prompt_entries), that our earlier local
// reimplementation of this rpc didn't have
export type TimelineItemType = 'memory' | 'gratitude' | 'photo' | 'prompt' | 'milestone';

export type TimelineFilter = 'all' | TimelineItemType | 'favorites';

// one row from the real backend's timeline_feed() rpc
export type TimelineFeedItem = {
  item_type: TimelineItemType;
  item_id: string;
  occurred_at: string;
  title: string;
  subtitle: string | null;
  entity_type: TimelineItemType;
  entity_id: string;
  is_favorite: boolean;
  // per-type extra fields — e.g. photo carries {storage_path, mood_tag, capture_source, ...}
  metadata: Record<string, unknown>;
};

const PAGE_SIZE = 20;

// calls the real backend's timeline_feed() rpc directly (not a local reimplementation) —
// filter -> rpc params, milestone-exclusion and full-text search are handled server-side there
export async function fetchTimelineFeed(options: {
  filter: TimelineFilter;
  search?: string;
  before?: { occurredAt: string; itemId: string };
}): Promise<TimelineFeedItem[]> {
  // "all" and "favorites" both mean "don't filter by type"
  const itemTypes = options.filter === 'all' || options.filter === 'favorites' ? null : [options.filter];
  const favoritesOnly = options.filter === 'favorites';
  const search = options.search?.trim();

  const { data, error } = await supabase.rpc('timeline_feed', {
    p_limit: PAGE_SIZE,
    p_before: options.before?.occurredAt ?? null,
    p_before_item_id: options.before?.itemId ?? null,
    p_item_types: itemTypes,
    p_favorites_only: favoritesOnly,
    p_search: search && search.length > 0 ? search : null,
    p_on_date: null,
  });
  if (error) throw error;
  return (data as TimelineFeedItem[] | null) ?? [];
}

// real backend's timeline_feed() always returns a generic title ('Presence photo', etc) —
// the "Bound - September 12th, 2026 - 10:27 a.m." style header is purely client-side, computed
// the same way ios's TimelineRowDisplayFormatter.headerLine(for:) does, not stored anywhere
const ROW_LABEL: Record<TimelineItemType, string> = {
  memory: 'Memory',
  gratitude: 'Gratitude',
  photo: 'Photo',
  prompt: 'Prompt',
  milestone: 'Milestone',
};

function rowLabel(item: TimelineFeedItem): string {
  if (item.item_type !== 'photo') return ROW_LABEL[item.item_type];
  // camera captures get the "Bound" brand label; library-picked photos stay plain "Photo"
  return item.metadata.capture_source === 'library' ? 'Photo' : 'Bound';
}

function ordinalDateString(date: Date): string {
  const day = date.getDate();
  const suffix = day >= 11 && day <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][day % 10] ?? 'th';
  const month = date.toLocaleDateString(undefined, { month: 'long' });
  return `${month} ${day}${suffix}, ${date.getFullYear()}`;
}

function timeString(date: Date): string {
  const hour24 = date.getHours();
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minute = date.getMinutes().toString().padStart(2, '0');
  const period = hour24 < 12 ? 'a.m.' : 'p.m.';
  return `${hour12}:${minute} ${period}`;
}

export function timelineHeaderLine(item: TimelineFeedItem): string {
  const date = new Date(item.occurred_at);
  return `${rowLabel(item)} - ${ordinalDateString(date)} - ${timeString(date)}`;
}

// stars/unstars any item type — one generic table backs all four
export async function setTimelineFavorite(
  entityType: TimelineItemType,
  entityId: string,
  isFavorite: boolean
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  if (isFavorite) {
    const { error } = await supabase
      .from('timeline_favorites')
      .upsert(
        { user_id: userId, entity_type: entityType, entity_id: entityId },
        { onConflict: 'user_id,entity_type,entity_id' }
      );
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('timeline_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);
    if (error) throw error;
  }
}
