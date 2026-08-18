import { supabase } from '@/lib/supabase';

export type TimelineItemType = 'memory' | 'photo' | 'prompt' | 'milestone';

export type TimelineFilter = 'all' | TimelineItemType | 'favorites';

export type TimelineFeedItem = {
  item_type: TimelineItemType;
  item_id: string;
  occurred_at: string;
  title: string;
  subtitle: string | null;
  entity_type: TimelineItemType;
  entity_id: string;
  is_favorite: boolean;
};

const PAGE_SIZE = 20;

// Mirrors iOS's TimelineViewModel.loadPage: filter -> RPC params, milestone-exclusion handled
// server-side (see timeline_feed() in supabase/schema.sql).
export async function fetchTimelineFeed(options: {
  filter: TimelineFilter;
  search?: string;
  before?: { occurredAt: string; itemId: string };
}): Promise<TimelineFeedItem[]> {
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
