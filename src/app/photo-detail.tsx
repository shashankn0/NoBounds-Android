import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import type { PresencePhoto, PresenceReaction } from '@/lib/database-types';
import { getSignedUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { setTimelineFavorite } from '@/lib/timeline';

// exact set from features/photos/presencephotodetailview.swift
const REACTION_EMOJI = ['❤️', '😊', '🔥', '🥹', '✨', '😘'];

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} at ${timePart}`;
}

export default function PhotoDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { photoId } = useLocalSearchParams<{ photoId: string }>();
  const { session } = useSession();

  const [photo, setPhoto] = useState<PresencePhoto | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [reactions, setReactions] = useState<PresenceReaction[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!photoId || !session) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: photoRow, error: photoError }, { data: reactionRows }, { data: favoriteRow }] = await Promise.all([
        supabase.from('presence_photos').select('*').eq('id', photoId).maybeSingle(),
        supabase.from('presence_reactions').select('id, photo_id, user_id, emoji, created_at').eq('photo_id', photoId),
        supabase
          .from('timeline_favorites')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('entity_type', 'photo')
          .eq('entity_id', photoId)
          .maybeSingle(),
      ]);
      if (photoError) throw photoError;
      const row = photoRow as PresencePhoto | null;
      setPhoto(row);
      setCaptionDraft(row?.caption ?? '');
      setReactions((reactionRows as PresenceReaction[] | null) ?? []);
      setIsFavorite(!!favoriteRow);
      if (row) setImageUrl(await getSignedUrl('presence', row.storage_path));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load photo');
    } finally {
      setLoading(false);
    }
  }, [photoId, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const isOwn = !!photo && photo.user_id === session?.user.id;
  const myReaction = reactions.find((r) => r.user_id === session?.user.id)?.emoji ?? null;
  const partnerReaction = reactions.find((r) => r.user_id !== session?.user.id)?.emoji ?? null;

  async function onToggleFavorite() {
    if (!photoId) return;
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await setTimelineFavorite('photo', photoId, next);
    } catch {
      setIsFavorite(!next);
    }
  }

  async function onReact(emoji: string) {
    if (!photoId || !session) return;
    try {
      if (myReaction === emoji) {
        await supabase.from('presence_reactions').delete().eq('photo_id', photoId).eq('user_id', session.user.id);
      } else {
        await supabase
          .from('presence_reactions')
          .upsert({ photo_id: photoId, user_id: session.user.id, emoji }, { onConflict: 'photo_id,user_id' });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not react');
    }
  }

  async function onSaveCaption() {
    if (!photoId) return;
    try {
      const { error: updateError } = await supabase
        .from('presence_photos')
        .update({ caption: captionDraft.trim() || null })
        .eq('id', photoId);
      if (updateError) throw updateError;
      setEditingCaption(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save caption');
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={[styles.headerButton, { backgroundColor: theme.surface }]}>
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <ThemedText type="smallBold">Photo</ThemedText>
        <Pressable onPress={onToggleFavorite} style={[styles.headerButton, { backgroundColor: theme.surface }]}>
          <Ionicons name={isFavorite ? 'star' : 'star-outline'} size={20} color={theme.accent} />
        </Pressable>
      </View>

      {loading || !photo ? (
        <ThemedText type="default" themeColor="textSecondary" style={styles.loading}>
          {loading ? 'Loading…' : 'Photo not found.'}
        </ThemedText>
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 20 }]}>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} /> : <View style={styles.image} />}

          {isOwn ? (
            editingCaption ? (
              <View style={styles.captionEditRow}>
                <TextInput
                  autoFocus
                  value={captionDraft}
                  onChangeText={setCaptionDraft}
                  placeholder="Add a caption"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.captionInput, { color: theme.textPrimary, borderColor: theme.border }]}
                  onSubmitEditing={onSaveCaption}
                />
                <Pressable onPress={onSaveCaption}>
                  <ThemedText type="smallBold" themeColor="accent">
                    Save
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setEditingCaption(true)} style={styles.captionRow}>
                <Ionicons name="chatbox-ellipses" size={18} color={theme.accent} />
                <ThemedText type="smallBold" themeColor="accent">
                  {photo.caption ? photo.caption : 'Add caption'}
                </ThemedText>
              </Pressable>
            )
          ) : photo.caption ? (
            <ThemedText type="default">{photo.caption}</ThemedText>
          ) : null}

          <ThemedText type="small" themeColor="textSecondary">
            {formatTimestamp(photo.created_at)}
          </ThemedText>

          <NBCard>
            <ThemedText type="small" themeColor="textSecondary" style={styles.reactLabel}>
              React
            </ThemedText>
            <View style={styles.reactRow}>
              {REACTION_EMOJI.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => onReact(emoji)}
                  style={[
                    styles.reactionChip,
                    { borderColor: theme.border },
                    myReaction === emoji && { backgroundColor: theme.accentMuted, borderColor: theme.accent },
                  ]}>
                  <ThemedText type="default">{emoji}</ThemedText>
                </Pressable>
              ))}
            </View>
            {partnerReaction ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.partnerReacted}>
                Partner reacted {partnerReaction}
              </ThemedText>
            ) : null}
          </NBCard>

          {error ? (
            <ThemedText type="small" themeColor="destructive">
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  loading: { padding: 20 },
  body: { padding: 20, gap: 12 },
  image: { width: '100%', aspectRatio: 3 / 4, borderRadius: 16, backgroundColor: 'rgba(120,120,120,0.25)' },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  captionEditRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  captionInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  reactLabel: { marginBottom: 10 },
  reactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reactionChip: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  partnerReacted: { marginTop: 10 },
});
