import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import type { PresenceCaptureSource } from '@/lib/database-types';
import { uploadPrivate } from '@/lib/storage';
import { errorMessage, supabase } from '@/lib/supabase';

// exact set from core/domain/presence/presencemodels.swift's presencemoodtag enum
const MOOD_TAGS = ['cozy', 'miss you', 'excited', 'thinking of you', 'good morning', 'sleepy'];

type Captured = { uri: string; mimeType: string; source: PresenceCaptureSource };

// this is "bound" in the ios app — the tab always opens straight to the camera (presencefastsendflow),
// not a history list. sent photos surface in home's "last bound" card and in timeline, where reacting
// happens on the single-photo detail screen — not here.
export default function PhotosScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { session, couple } = useSession();

  // explicit width/height rather than aspectRatio: with only a ratio to go on, yoga sizes the
  // box off its own height and leaves it pinned left instead of stretching across
  const previewWidth = screenWidth - Spacing.three * 2;
  const previewSize = { width: previewWidth, height: (previewWidth * 4) / 3 };
  // the compose screen insets its photo further than the viewfinder, matching ios
  const composeWidth = screenWidth * 0.66;
  const composeSize = { width: composeWidth, height: (composeWidth * 4) / 3 };
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [caption, setCaption] = useState('');
  const [moodTag, setMoodTag] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);

  async function onCapture() {
    if (!cameraRef || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.takePictureAsync({ quality: 0.7 });
      setCaptured({ uri: photo.uri, mimeType: photo.format === 'png' ? 'image/png' : 'image/jpeg', source: 'camera' });
    } finally {
      setCapturing(false);
    }
  }

  async function onPickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled) return;
    const asset = result.assets[0];
    setCaptured({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg', source: 'library' });
  }

  function onCancelCompose() {
    setCaptured(null);
    setCaption('');
    setMoodTag(null);
    setError(null);
  }

  async function onSend() {
    if (!captured || !session || !couple) return;
    setSending(true);
    setError(null);
    try {
      const extension = captured.mimeType.split('/')[1] ?? 'jpg';
      const path = `${couple.id}/${Date.now()}.${extension}`;
      await uploadPrivate('presence', path, captured.uri, captured.mimeType);
      const { error: insertError } = await supabase.from('presence_photos').insert({
        couple_id: couple.id,
        user_id: session.user.id,
        storage_path: path,
        caption: caption.trim() || null,
        mood_tag: moodTag,
        capture_source: captured.source,
      });
      if (insertError) throw insertError;
      onCancelCompose();
      setSent(true);
      setTimeout(() => setSent(false), 1200);
    } catch (err) {
      setError(errorMessage(err, 'Could not send'));
    } finally {
      setSending(false);
    }
  }

  if (!couple) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <ScreenHeader />
        <View style={[styles.container, { paddingBottom: insets.bottom + BottomTabInset }]}>
          <NBCard>
            <ThemedText type="title">Partner presence</ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
              Share moments with your partner after you connect. Bound photos are couple-only and do not
              have a solo mode.
            </ThemedText>
            <View style={styles.cardButton}>
              <NBPrimaryButton title="Invite your partner" onPress={() => router.push('/pairing')} />
            </View>
          </NBCard>
        </View>
      </ThemedView>
    );
  }

  // permission not resolved yet
  if (!permission) {
    return <ThemedView style={{ flex: 1 }} />;
  }

  // denied — explain in-app rather than re-prompting the system dialog on a loop
  if (!permission.granted) {
    return (
      <ThemedView style={[styles.permissionScreen, { paddingTop: insets.top + Spacing.four }]}>
        <Ionicons name="camera" size={40} color={theme.accent} style={styles.permissionIcon} />
        <ThemedText type="title" style={styles.centeredText}>
          Camera access needed
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
          {permission.canAskAgain
            ? 'Take a quick photo to share with your partner.'
            : "Camera access is off for No Bounds. Enable it in your phone's Settings to use Bound."}
        </ThemedText>
        {permission.canAskAgain ? (
          <View style={styles.permissionButton}>
            <NBPrimaryButton title="Allow camera access" onPress={requestPermission} />
          </View>
        ) : null}
      </ThemedView>
    );
  }

  // captured or picked a photo — compose a caption/mood, then actually send it
  if (captured) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <Image
          source={{ uri: captured.uri }}
          style={[styles.composePreview, composeSize, { marginTop: insets.top + Spacing.two }]}
        />
        <ScrollView contentContainerStyle={[styles.composeBody, { paddingBottom: insets.bottom + BottomTabInset }]}>
          <ThemedText type="smallBold">Caption</ThemedText>
          <TextInput
            placeholder="Optional message"
            placeholderTextColor={theme.textSecondary}
            value={caption}
            onChangeText={setCaption}
            style={[styles.captionInput, { color: theme.textPrimary, backgroundColor: theme.surface }]}
          />
          <ThemedText type="smallBold">Mood</ThemedText>
          <View style={styles.moodRow}>
            {MOOD_TAGS.map((tag) => {
              const active = moodTag === tag;
              return (
                <Pressable
                  key={tag}
                  onPress={() => setMoodTag(active ? null : tag)}
                  style={[
                    styles.moodChip,
                    { borderColor: active ? theme.accent : theme.border, backgroundColor: active ? theme.accentMuted : 'transparent' },
                  ]}>
                  <ThemedText type="small">{tag}</ThemedText>
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <ThemedText type="small" themeColor="destructive">
              {error}
            </ThemedText>
          ) : null}

          {/* ios pairs a small dark "back to camera" circle with a big accent send circle */}
          <View style={styles.composeButtons}>
            <Pressable onPress={onCancelCompose} style={styles.retakeCircle} disabled={sending}>
              <Ionicons name="arrow-undo" size={24} color="#ffffff" />
            </Pressable>
            <Pressable
              onPress={onSend}
              disabled={sending}
              style={[styles.sendCircle, { backgroundColor: theme.accent, opacity: sending ? 0.6 : 1 }]}>
              <Ionicons name="send" size={28} color="#ffffff" />
            </Pressable>
            <View style={styles.composeSpacer} />
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <View style={styles.fill}>
      {/* the viewfinder is an inset 3:4 rounded box on black, not a full-bleed preview */}
      <View style={[styles.viewfinder, previewSize, { marginTop: insets.top + Spacing.three }]}>
        <CameraView ref={setCameraRef} style={styles.viewfinderCamera} facing={facing} flash={flash} />

        <Pressable
          onPress={() => setFlash(flash === 'off' ? 'on' : 'off')}
          style={[styles.viewfinderButton, styles.flashButton]}
          disabled={facing === 'front'}>
          <Ionicons
            name={flash === 'off' ? 'flash-off' : 'flash'}
            size={20}
            color={facing === 'front' ? 'rgba(255,255,255,0.35)' : '#ffffff'}
          />
        </Pressable>

        <View style={[styles.viewfinderButton, styles.zoomBadge]}>
          <ThemedText type="smallBold" style={styles.zoomText}>
            1x
          </ThemedText>
        </View>
      </View>

      {sent ? (
        <View style={styles.sentOverlay}>
          <View style={[styles.sentPill, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" style={{ color: theme.textOnAccent }}>
              Sent!
            </ThemedText>
          </View>
        </View>
      ) : null}

      {/* library, shutter, flip — centered in the black space under the viewfinder */}
      <View style={[styles.controlsRow, { paddingBottom: insets.bottom + BottomTabInset }]}>
        <Pressable onPress={onPickFromLibrary} style={[styles.sideButton, styles.librarySquare]}>
          <Ionicons name="images" size={26} color="#ffffff" />
        </Pressable>

        <Pressable onPress={onCapture} disabled={capturing} style={styles.shutterOuter}>
          <View style={[styles.shutterRing, { backgroundColor: theme.accent }]}>
            <View style={styles.shutterInner} />
          </View>
        </Pressable>

        <Pressable onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} style={[styles.sideButton, styles.flipCircle]}>
          <Ionicons name="camera-reverse" size={26} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  cardBody: { marginTop: 8, marginBottom: 4 },
  cardButton: { marginTop: 8 },
  fill: { flex: 1, backgroundColor: '#000000' },
  sentOverlay: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  sentPill: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 999 },
  // 3:4 is the camera's own portrait aspect, so the preview fills the box without stretching
  viewfinder: {
    alignSelf: 'center',
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  viewfinderCamera: { flex: 1, borderRadius: 28 },
  viewfinderButton: {
    position: 'absolute',
    top: Spacing.three,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  flashButton: { left: Spacing.three },
  zoomBadge: { right: Spacing.three },
  zoomText: { color: '#ffffff' },
  controlsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
  },
  sideButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ios uses a rounded square for the library button and a circle for the flip button
  librarySquare: { borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)' },
  flipCircle: { borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.14)' },
  // three concentric rings, same as ios: white outline, accent band, white centre
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRing: {
    width: 69,
    height: 69,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 57,
    height: 57,
    borderRadius: 29,
    backgroundColor: '#ffffff',
  },
  composePreview: { alignSelf: 'center', borderRadius: 28 },
  composeBody: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: Spacing.two },
  captionInput: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  moodChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  composeButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.three },
  retakeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  sendCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#ffffff',
  },
  // keeps the send circle centered while the retake circle sits on the left, like ios
  composeSpacer: { width: 64 },
  permissionScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  permissionIcon: { marginBottom: Spacing.two },
  centeredText: { textAlign: 'center' },
  permissionButton: { marginTop: Spacing.three, alignSelf: 'stretch' },
});
