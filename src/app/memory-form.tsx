import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const MAX_PHOTOS = 10;

export default function MemoryFormScreen() {
  const theme = useTheme();
  const { couple } = useSession();
  const [photoUris, setPhotoUris] = useState<string[]>([]);
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
      setPhotoUris(result.assets.map((a) => a.uri).slice(0, MAX_PHOTOS));
    }
  }

  async function onSave() {
    if (!couple || title.trim().length === 0) return;
    setSaving(true);
    setError(null);

    // The prototype's `memories` table only has a single photo_url column — the real app
    // supports multiple photos per memory via a separate table, not wired up here yet.
    let photoUrl: string | null = null;
    const firstUri = photoUris[0];
    if (firstUri) {
      const response = await fetch(firstUri);
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

    const caption = notes.trim().length > 0 ? `${title.trim()} — ${notes.trim()}` : title.trim();
    const { error: insertError } = await supabase
      .from('memories')
      .insert({ couple_id: couple.id, caption, photo_url: photoUrl });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
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
        rightDisabled={title.trim().length === 0 || saving || !couple}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText type="title">Photos</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Add photos to your memory
        </ThemedText>

        {photoUris.length === 0 ? (
          <View style={[styles.dropZone, { borderColor: theme.border }]}>
            <Ionicons name="images-outline" size={32} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.dropZoneText}>
              Your photos will appear here
            </ThemedText>
          </View>
        ) : (
          <View style={styles.previewGrid}>
            {photoUris.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.previewThumb} />
            ))}
          </View>
        )}

        <Pressable
          onPress={onChoosePhotos}
          style={[styles.chooseButton, { backgroundColor: theme.accentMuted + '33' }]}>
          <Ionicons name="images-outline" size={18} color={theme.accent} />
          <ThemedText type="smallBold" themeColor="accent">
            Choose photos
          </ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary">
          {photoUris.length}/{MAX_PHOTOS} photos
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
