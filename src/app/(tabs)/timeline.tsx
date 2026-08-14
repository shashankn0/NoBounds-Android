import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
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
import { supabase } from '@/lib/supabase';

type Memory = {
  id: string;
  caption: string;
  photo_url: string | null;
  created_at: string;
  author_id: string;
};

const FILTER_CHIPS = ['All', 'Memories', 'Photos', 'Prompts', 'Milestones', 'Favorites'] as const;

export default function TimelineScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { couple } = useSession();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [caption, setCaption] = useState('');
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<(typeof FILTER_CHIPS)[number]>('All');
  const [showCompose, setShowCompose] = useState(false);

  const load = useCallback(async () => {
    if (!couple) return;
    const { data } = await supabase
      .from('memories')
      .select('id, caption, photo_url, created_at, author_id')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false });
    setMemories((data as Memory[] | null) ?? []);
  }, [couple]);

  useEffect(() => {
    load();
  }, [load]);

  async function onPickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setPickedImageUri(result.assets[0].uri);
    }
  }

  async function onSubmit() {
    if (!couple || caption.trim().length === 0) return;
    setSaving(true);
    setError(null);

    let photoUrl: string | null = null;
    if (pickedImageUri) {
      const response = await fetch(pickedImageUri);
      const blob = await response.blob();
      const path = `${couple.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('memories').upload(path, blob, {
        contentType: 'image/jpeg',
      });
      if (uploadError) {
        setError(uploadError.message);
        setSaving(false);
        return;
      }
      photoUrl = supabase.storage.from('memories').getPublicUrl(path).data.publicUrl;
    }

    const { error: insertError } = await supabase
      .from('memories')
      .insert({ couple_id: couple.id, caption: caption.trim(), photo_url: photoUrl });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setCaption('');
    setPickedImageUri(null);
    setShowCompose(false);
    await load();
  }

  const filtered = memories.filter((m) =>
    search.trim().length === 0 ? true : m.caption.toLowerCase().includes(search.trim().toLowerCase())
  );

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
            onPress={() => setShowCompose(true)}
            style={[styles.chip, styles.addChip, { backgroundColor: theme.accent }]}>
            <Ionicons name="add" size={18} color={theme.textOnAccent} />
          </Pressable>
          {FILTER_CHIPS.map((chip) => {
            const active = chip === activeFilter;
            const chipColor = active ? theme.textOnAccent : theme.textPrimary;
            return (
              <Pressable
                key={chip}
                onPress={() => setActiveFilter(chip)}
                style={[
                  styles.chip,
                  styles.filterChip,
                  { backgroundColor: active ? theme.accentMuted : theme.surface, borderColor: theme.border },
                ]}>
                {chip === 'Favorites' ? (
                  <Ionicons name={active ? 'star' : 'star-outline'} size={14} color={chipColor} />
                ) : null}
                <ThemedText type="small" style={{ color: chipColor }}>
                  {chip}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        {showCompose ? (
          <NBCard>
            <TextInput
              placeholder="What's the memory?"
              placeholderTextColor={theme.textSecondary}
              value={caption}
              onChangeText={setCaption}
              style={[styles.input, { color: theme.textPrimary }]}
            />
            {pickedImageUri ? <Image source={{ uri: pickedImageUri }} style={styles.previewImage} /> : null}
            <View style={styles.composeActions}>
              <Pressable onPress={onPickImage}>
                <ThemedText type="link" themeColor="accent">
                  {pickedImageUri ? 'Change photo' : 'Add photo'}
                </ThemedText>
              </Pressable>
              <Pressable
                disabled={saving || caption.trim().length === 0}
                onPress={onSubmit}
                style={[styles.smallButton, { backgroundColor: theme.accent, opacity: caption.trim().length === 0 ? 0.5 : 1 }]}>
                <ThemedText type="smallBold" style={{ color: theme.textOnAccent }}>
                  {saving ? 'Saving…' : 'Add'}
                </ThemedText>
              </Pressable>
            </View>
            {error ? (
              <ThemedText type="small" themeColor="destructive">
                {error}
              </ThemedText>
            ) : null}
          </NBCard>
        ) : null}

        {!couple ? null : filtered.length === 0 ? (
          <NBCard style={styles.centered}>
            <Ionicons name="time" size={40} color={theme.accent} style={styles.emptyIcon} />
            <ThemedText type="title" style={styles.centeredText}>
              Your shared archive
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
              Memories, photos, and prompts will gather here as you use No Bounds together.
            </ThemedText>
          </NBCard>
        ) : (
          <View style={styles.feed}>
            {filtered.map((item) => (
              <NBCard key={item.id}>
                {item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.memoryImage} /> : null}
                <ThemedText type="default">{item.caption}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {new Date(item.created_at).toLocaleDateString()}
                </ThemedText>
              </NBCard>
            ))}
          </View>
        )}
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
  input: { fontSize: 16, marginBottom: 8 },
  previewImage: { width: '100%', height: 160, borderRadius: 12, marginBottom: 8 },
  composeActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  smallButton: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12 },
  centered: { alignItems: 'center', gap: 4 },
  centeredText: { textAlign: 'center' },
  emptyIcon: { marginBottom: 4 },
  feed: { gap: 12 },
  memoryImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 8 },
});
