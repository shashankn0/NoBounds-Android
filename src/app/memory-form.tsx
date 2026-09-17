import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage, supabase } from '@/lib/supabase';
import { uploadPrivate } from '@/lib/storage';

const MAX_PHOTOS = 10;

export default function MemoryFormScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, couple } = useSession();
  // keeps the full picked asset (not just the uri) so the real mime type survives to upload time
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChoosePhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS,
    });
    if (!result.canceled) {
      setPhotos(result.assets.slice(0, MAX_PHOTOS));
    }
  }

  async function onSave() {
    if (!session || title.trim().length === 0) return;
    setSaving(true);
    setError(null);

    // real timeline_memories is solo-capable (couple_id nullable), same pattern as habits —
    // merges into the couple automatically once paired, so no need to gate saving on pairing
    const { data: inserted, error: insertError } = await supabase
      .from('timeline_memories')
      .insert({
        couple_id: couple?.id ?? null,
        owner_user_id: session.user.id,
        title: title.trim(),
        body: notes.trim().length > 0 ? notes.trim() : null,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      setSaving(false);
      setError(insertError?.message ?? 'Could not save memory');
      return;
    }

    // real backend supports multiple photos per memory via a child table — upload every
    // picked photo, not just the first
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const mimeType = photo.mimeType ?? 'image/jpeg';
      const extension = mimeType.split('/')[1] ?? 'jpg';
      const path = `${inserted.id}/${Date.now()}-${i}.${extension}`;
      try {
        await uploadPrivate('memory-photos', path, photo.uri, mimeType);
        const { error: photoError } = await supabase
          .from('timeline_memory_photos')
          .insert({ memory_id: inserted.id, storage_path: path, sort_order: i });
        if (photoError) throw photoError;
      } catch (err) {
        setSaving(false);
        setError(errorMessage(err, 'Memory saved, but a photo failed to upload'));
        return;
      }
    }

    setSaving(false);
    router.back();
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader
        title="New memory"
        leftIcon="chevron-back"
        onLeftPress={() => router.back()}
        rightLabel={saving ? 'Saving…' : 'Save'}
        onRightPress={onSave}
        rightDisabled={title.trim().length === 0 || saving}
      />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        <ThemedText type="title">Photos</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Add photos to your memory
        </ThemedText>

        {photos.length === 0 ? (
          <View style={[styles.dropZone, { borderColor: theme.border }]}>
            <Ionicons name="images" size={32} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.dropZoneText}>
              Your photos will appear here
            </ThemedText>
          </View>
        ) : (
          <View style={styles.previewGrid}>
            {photos.map((asset) => (
              <Image key={asset.uri} source={{ uri: asset.uri }} style={styles.previewThumb} />
            ))}
          </View>
        )}

        <Pressable
          onPress={onChoosePhotos}
          style={[styles.chooseButton, { backgroundColor: theme.accentMuted + '33' }]}>
          <Ionicons name="images" size={18} color={theme.accent} />
          <ThemedText type="smallBold" themeColor="accent">
            Choose photos
          </ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary">
          {photos.length}/{MAX_PHOTOS} photos
        </ThemedText>

        <NBCard>
          <ThemedText type="small" themeColor="textSecondary">
            Title
          </ThemedText>
          <TextInput
            placeholder="Give this memory a title"
            placeholderTextColor={theme.textSecondary}
            value={title}
            onChangeText={setTitle}
            style={[styles.input, { color: theme.textPrimary }]}
          />

          <ThemedText type="small" themeColor="textSecondary" style={styles.fieldSpacing}>
            Notes (optional)
          </ThemedText>
          <TextInput
            placeholder="What stood out this week?"
            placeholderTextColor={theme.textSecondary}
            value={notes}
            onChangeText={setNotes}
            multiline
            style={[styles.input, styles.multilineInput, { color: theme.textPrimary }]}
          />

          <ThemedText type="small" themeColor="textSecondary" style={styles.fieldSpacing}>
            Date
          </ThemedText>
          <View style={[styles.datePill, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="default">
              {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </ThemedText>
          </View>
        </NBCard>

        {!couple ? (
          <ThemedText type="small" themeColor="textSecondary">
            Saved to your private archive until you connect.
          </ThemedText>
        ) : null}

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
  container: { padding: 20, gap: 12 },
  dropZone: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dropZoneText: {},
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewThumb: { width: 80, height: 80, borderRadius: 12 },
  chooseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
  },
  input: { fontSize: 16, marginTop: 4 },
  multilineInput: { minHeight: 70, textAlignVertical: 'top' },
  fieldSpacing: { marginTop: 16 },
  datePill: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start', marginTop: 4 },
});
