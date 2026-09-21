import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonthCalendar } from '@/components/month-calendar';
import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { getSignedUrls } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import {
  fetchTimelineFeed,
  setTimelineFavorite,
  timelineHeaderLine,
  type TimelineFeedItem,
  type TimelineFilter,
} from '@/lib/timeline';

// trimmed from ios's timelinefilter.chips per the product ask: one "All memories" bucket (the
// unfiltered feed, so memory/gratitude/prompt items all live in it) plus Photos, Milestones, Favorites
const FILTER_CHIPS: { id: TimelineFilter; label: string }[] = [
  { id: 'all', label: 'All memories' },
  { id: 'photo', label: 'Photos' },
  { id: 'milestone', label: 'Milestones' },
  { id: 'favorites', label: 'Favorites' },
];

const TYPE_ICON: Record<TimelineFeedItem['item_type'], keyof typeof Ionicons.glyphMap> = {
  memory: 'book',
  gratitude: 'heart',
  photo: 'image',
  prompt: 'chatbubble-ellipses',
  milestone: 'flag',
};

export default function TimelineScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { couple } = useSession();
  const [items, setItems] = useState<TimelineFeedItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>('all');

  // mirrors ios's enrichphotothumbnails: the feed itself only returns bare paths, so thumbnails
  // are resolved to signed urls in a second pass. presence (bound) photos already carry their
  // path in the feed's own metadata; memory photos live in a separate one-to-many table, so
  // that side needs its own lookup (first photo per memory, by sort_order)
  const loadThumbnails = useCallback(async (feedItems: TimelineFeedItem[]) => {
    const presencePaths = feedItems
      .filter((i): i is TimelineFeedItem & { metadata: { storage_path: string } } =>
        i.item_type === 'photo' && typeof i.metadata?.storage_path === 'string'
      )
      .map((i) => ({ entityId: i.entity_id, path: i.metadata.storage_path }));

    const memoryIds = feedItems.filter((i) => i.item_type === 'memory').map((i) => i.entity_id);
    let memoryPaths: { entityId: string; path: string }[] = [];
    if (memoryIds.length > 0) {
      const { data } = await supabase
        .from('timeline_memory_photos')
        .select('memory_id, storage_path')
        .in('memory_id', memoryIds)
        .order('sort_order', { ascending: true });
      const firstPerMemory = new Map<string, string>();
      for (const row of (data ?? []) as { memory_id: string; storage_path: string }[]) {
        if (!firstPerMemory.has(row.memory_id)) firstPerMemory.set(row.memory_id, row.storage_path);
      }
      memoryPaths = Array.from(firstPerMemory, ([entityId, path]) => ({ entityId, path }));
    }

    if (presencePaths.length === 0 && memoryPaths.length === 0) {
      setThumbnails({});
      return;
    }

    // different buckets, so each group gets its own signed-url batch
    const [presenceSigned, memorySigned] = await Promise.all([
      getSignedUrls('presence', presencePaths.map((p) => p.path)),
      getSignedUrls('memory-photos', memoryPaths.map((p) => p.path)),
    ]);

    const byEntityId: Record<string, string> = {};
    for (const { entityId, path } of presencePaths) {
      if (presenceSigned[path]) byEntityId[entityId] = presenceSigned[path];
    }
    for (const { entityId, path } of memoryPaths) {
      if (memorySigned[path]) byEntityId[entityId] = memorySigned[path];
    }
    setThumbnails(byEntityId);
  }, []);

  const requestRef = useRef(0);
  const load = useCallback(async () => {
    if (!couple) return;
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const feed = await fetchTimelineFeed({ filter: activeFilter, search });
      if (request !== requestRef.current) return; // a newer search/filter superseded this response
      setItems(feed);
      await loadThumbnails(feed);
    } catch (err) {
      if (request === requestRef.current) setError(err instanceof Error ? err.message : 'Could not load timeline');
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [couple, activeFilter, search, loadThumbnails]);

  // refetch whenever this tab regains focus, so a memory saved via memory-form shows up on return.
  // this must only fire on focus: it used to depend on `load`, which changes with every keystroke,
  // so typing in the search box triggered an immediate fetch per key on top of the debounced one.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      loadRef.current();
    }, [])
  );

  // debounce search/filter changes so we're not refetching on every keystroke (the first run is the
  // mount, which the focus effect above already covers)
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const timeout = setTimeout(() => loadRef.current(), 300);
    return () => clearTimeout(timeout);
  }, [search, activeFilter]);

  async function onToggleFavorite(item: TimelineFeedItem) {
    const next = !item.is_favorite;
    setItems((prev) => prev.map((i) => (i.item_id === item.item_id ? { ...i, is_favorite: next } : i)));
    try {
      await setTimelineFavorite(item.entity_type, item.entity_id, next);
      if (activeFilter === 'favorites' && !next) {
        setItems((prev) => prev.filter((i) => i.item_id !== item.item_id));
      }
    } catch {
      setItems((prev) => prev.map((i) => (i.item_id === item.item_id ? { ...i, is_favorite: !next } : i)));
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScreenHeader showPairing />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + BottomTabInset }]}>
        <NBCard>
          <MonthCalendar />
        </NBCard>

        {!couple ? (
          <NBCard>
            <ThemedText type="title">Shared timeline</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.cardBody}>
              Memories and habits you add now will merge into a shared timeline when you connect with your
              partner.
            </ThemedText>
            <View style={styles.cardButton}>
              <NBPrimaryButton title="Invite your partner" onPress={() => router.push('/pairing')} />
            </View>
          </NBCard>
        ) : null}

        <View style={styles.feedSection}>
        <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            placeholder="Search All"
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: theme.textPrimary }]}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {/* ios: a plain surface capsule with a border, not an accent-filled button */}
          <Pressable
            onPress={() => router.push('/memory-form')}
            style={[styles.chip, styles.addChip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="add" size={14} color={theme.textPrimary} />
          </Pressable>
          {FILTER_CHIPS.map((chip) => {
            const active = chip.id === activeFilter;
            // ios: selected = accent text on a 15% accent tint; unselected = primary text on surface
            const chipColor = active ? theme.accent : theme.textPrimary;
            return (
              <Pressable
                key={chip.id}
                onPress={() => setActiveFilter(chip.id)}
                style={[
                  styles.chip,
                  styles.filterChip,
                  { backgroundColor: active ? theme.accent + '26' : theme.surface, borderColor: theme.border },
                ]}>
                {chip.id === 'favorites' ? (
                  <Ionicons name={active ? 'star' : 'star-outline'} size={14} color={chipColor} />
                ) : null}
                <ThemedText type="small" style={{ color: chipColor, fontWeight: '600' }}>
                  {chip.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        {!couple ? null : loading && items.length === 0 ? (
          <ThemedText type="default" themeColor="textSecondary">
            Loading…
          </ThemedText>
        ) : items.length === 0 ? (
          <NBCard style={styles.centered}>
            <Ionicons name="time" size={40} color={theme.accent} style={styles.emptyIcon} />
            <ThemedText type="title" style={styles.centeredText}>
              {search.trim().length > 0 ? 'No matches' : 'Your shared archive'}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
              {search.trim().length > 0
                ? `No timeline items match "${search.trim()}".`
                : 'Memories, photos, and prompts will gather here as you use No Bounds together.'}
            </ThemedText>
          </NBCard>
        ) : (
          <View style={styles.feed}>
            {items.map((item) => (
              <NBCard key={`${item.item_type}-${item.item_id}`}>
                {/* ios TimelineRowView: tap opens, long-press (context menu) toggles the favorite */}
                <Pressable
                  onPress={item.item_type === 'photo' ? () => router.push({ pathname: '/photo-detail', params: { photoId: item.entity_id } }) : undefined}
                  onLongPress={() => onToggleFavorite(item)}
                  style={styles.itemPressable}>
                  {thumbnails[item.entity_id] ? (
                    <Image source={{ uri: thumbnails[item.entity_id] }} style={styles.itemThumb} resizeMethod="resize" />
                  ) : (
                    <Ionicons name={TYPE_ICON[item.item_type]} size={18} color={theme.accent} style={styles.itemIcon} />
                  )}
                  <View style={styles.itemText}>
                    <View style={styles.itemHeaderRow}>
                      <ThemedText type="default" style={styles.itemTitle}>
                        {timelineHeaderLine(item)}
                      </ThemedText>
                      {item.is_favorite ? <Ionicons name="star" size={12} color={theme.accent} /> : null}
                    </View>
                    {item.subtitle ? (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.itemSubtitle}>
                        {item.subtitle}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              </NBCard>
            ))}
          </View>
        )}

        </View>

        {error ? (
          <ThemedText type="small" themeColor="destructive">
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  // ios TimelineTabView: 16 side padding, 8 top, 20 between the calendar card and the feed section
  container: { paddingHorizontal: 16, paddingTop: 8, gap: 20 },
  feedSection: { gap: 12 },
  cardBody: { marginTop: 8 },
  cardButton: { marginTop: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16 },
  chipsRow: { gap: 8, paddingRight: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addChip: { alignItems: 'center', justifyContent: 'center' },
  centered: { alignItems: 'center', gap: 4 },
  centeredText: { textAlign: 'center' },
  emptyIcon: { marginBottom: 4 },
  feed: { gap: 8 },
  itemPressable: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  itemIcon: { width: 28, textAlign: 'center' },
  itemThumb: { width: 64, height: 64, borderRadius: 12 },
  itemText: { flex: 1, gap: 4 },
  itemHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemTitle: { flex: 1, fontWeight: '500' },
  itemSubtitle: { fontSize: 14, lineHeight: 19 },
});
