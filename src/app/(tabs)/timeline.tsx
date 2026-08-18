import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { fetchTimelineFeed, setTimelineFavorite, type TimelineFeedItem, type TimelineFilter } from '@/lib/timeline';

// Matches TimelineFilter.chips in ../NoBounds/NoBounds/Core/Domain/Timeline/TimelineModels.swift
const FILTER_CHIPS: { id: TimelineFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'memory', label: 'Memories' },
  { id: 'photo', label: 'Photos' },
  { id: 'prompt', label: 'Prompts' },
  { id: 'milestone', label: 'Milestones' },
  { id: 'favorites', label: 'Favorites' },
];

const TYPE_ICON: Record<TimelineFeedItem['item_type'], keyof typeof Ionicons.glyphMap> = {
  memory: 'book-outline',
  photo: 'image-outline',
  prompt: 'chatbubble-ellipses-outline',
  milestone: 'flag-outline',
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

  // Mirrors iOS's enrichPhotoThumbnails: the feed itself only returns bare paths, so thumbnails
  // are resolved to signed URLs in a second pass, keyed by the owning memory's id.
  const loadThumbnails = useCallback(async (feedItems: TimelineFeedItem[]) => {
    const memoryIds = feedItems.filter((i) => i.item_type === 'memory').map((i) => i.entity_id);
    if (memoryIds.length === 0) {
      setThumbnails({});
      return;
    }
    const { data } = await supabase.from('memories').select('id, photo_path').in('id', memoryIds);
    const paths = (data ?? [])
      .filter((row): row is { id: string; photo_path: string } => !!row.photo_path)
      .map((row) => ({ id: row.id, path: row.photo_path }));
    if (paths.length === 0) {
      setThumbnails({});
      return;
    }
    const signed = await getSignedUrls(
      'memory-photos',
      paths.map((p) => p.path)
    );
    const byMemoryId: Record<string, string> = {};
    for (const { id, path } of paths) {
      if (signed[path]) byMemoryId[id] = signed[path];
    }
    setThumbnails(byMemoryId);
  }, []);

  const load = useCallback(async () => {
    if (!couple) return;
    setLoading(true);
    setError(null);
    try {
      const feed = await fetchTimelineFeed({ filter: activeFilter, search });
      setItems(feed);
      await loadThumbnails(feed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load timeline');
    } finally {
      setLoading(false);
    }
  }, [couple, activeFilter, search, loadThumbnails]);

  // Refetch whenever this tab regains focus, so a memory saved via memory-form shows up on return.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Debounce search so we're not refetching on every keystroke.
  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <ScreenHeader centerLabel={couple ? 'Paired with Partner 💛' : undefined} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + BottomTabInset }]}>
        <NBCard>
          <MonthCalendar />
        </NBCard>

        {!couple ? (
          <NBCard>
            <ThemedText type="title">Shared timeline</ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
              Memories and habits you add now will merge into a shared timeline when you connect with your
              partner.
            </ThemedText>
            <View style={styles.cardButton}>
              <NBPrimaryButton title="Invite your partner" onPress={() => router.push('/pairing')} />
            </View>
          </NBCard>
        ) : null}

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
          <Pressable
            onPress={() => router.push('/memory-form')}
            style={[styles.chip, styles.addChip, { backgroundColor: theme.accent }]}>
            <Ionicons name="add" size={18} color={theme.textOnAccent} />
          </Pressable>
          {FILTER_CHIPS.map((chip) => {
            const active = chip.id === activeFilter;
            const chipColor = active ? theme.textOnAccent : theme.textPrimary;
            return (
              <Pressable
                key={chip.id}
                onPress={() => setActiveFilter(chip.id)}
                style={[
                  styles.chip,
                  styles.filterChip,
                  { backgroundColor: active ? theme.accentMuted : theme.surface, borderColor: theme.border },
                ]}>
                {chip.id === 'favorites' ? (
                  <Ionicons name={active ? 'star' : 'star-outline'} size={14} color={chipColor} />
                ) : null}
                <ThemedText type="small" style={{ color: chipColor }}>
                  {chip.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        {!couple ? null : loading ? (
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
              <NBCard key={`${item.item_type}-${item.item_id}`} style={styles.itemCard}>
                {thumbnails[item.entity_id] ? (
                  <Image source={{ uri: thumbnails[item.entity_id] }} style={styles.itemThumb} />
                ) : (
                  <Ionicons name={TYPE_ICON[item.item_type]} size={20} color={theme.accent} style={styles.itemIcon} />
                )}
                <View style={styles.itemText}>
                  <ThemedText type="default">{item.title}</ThemedText>
                  {item.subtitle ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.subtitle}
                    </ThemedText>
                  ) : null}
                  <ThemedText type="small" themeColor="textSecondary">
                    {new Date(item.occurred_at).toLocaleDateString()}
                  </ThemedText>
                </View>
                <Pressable onPress={() => onToggleFavorite(item)} hitSlop={8}>
                  <Ionicons
                    name={item.is_favorite ? 'star' : 'star-outline'}
                    size={20}
                    color={item.is_favorite ? theme.accent : theme.textSecondary}
                  />
                </Pressable>
              </NBCard>
            ))}
          </View>
        )}

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
  container: { padding: 20, gap: 16 },
  cardBody: { marginTop: 8 },
  cardButton: { marginTop: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  chipsRow: { gap: 8, paddingRight: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addChip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 0 },
  centered: { alignItems: 'center', gap: 4 },
  centeredText: { textAlign: 'center' },
  emptyIcon: { marginBottom: 4 },
  feed: { gap: 12 },
  itemCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  itemIcon: { marginTop: 2 },
  itemThumb: { width: 44, height: 44, borderRadius: 10 },
  itemText: { flex: 1, gap: 2 },
});
