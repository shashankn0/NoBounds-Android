import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NBPrimaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// viewfinder + capture only for now — compose (caption/mood) and send land in the next pass
export default function BoundCameraScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  async function onCapture() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setCapturedUri(photo.uri);
    } finally {
      setCapturing(false);
    }
  }

  // permission not resolved yet
  if (!permission) {
    return <ThemedView style={{ flex: 1 }} />;
  }

  // denied — explain in-app rather than re-prompting the system dialog on a loop
  if (!permission.granted) {
    return (
      <ThemedView style={[styles.permissionScreen, { paddingTop: insets.top + Spacing.four }]}>
        <Ionicons name="camera-outline" size={40} color={theme.accent} style={styles.permissionIcon} />
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
        <Pressable onPress={() => router.back()} style={styles.permissionCancel}>
          <ThemedText type="link" themeColor="accent">
            Cancel
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  // just took a photo — retake or close, compose/send isn't wired up yet
  if (capturedUri) {
    return (
      <View style={styles.fill}>
        <Image source={{ uri: capturedUri }} style={styles.fill} />
        <View style={[styles.previewControls, { paddingBottom: insets.bottom + Spacing.four }]}>
          <Pressable onPress={() => setCapturedUri(null)} style={styles.previewButton}>
            <Ionicons name="refresh" size={20} color="#ffffff" />
            <ThemedText type="smallBold" style={styles.previewButtonText}>
              Retake
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.previewButton}>
            <Ionicons name="close" size={20} color="#ffffff" />
            <ThemedText type="smallBold" style={styles.previewButtonText}>
              Close
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView ref={cameraRef} style={styles.fill} facing={facing} flash={flash} />

      <Pressable
        onPress={() => router.back()}
        style={[styles.closeButton, { top: insets.top + Spacing.two }]}>
        <Ionicons name="close" size={22} color="#ffffff" />
      </Pressable>

      <View style={[styles.controlsRow, { paddingBottom: insets.bottom + Spacing.four }]}>
        <Pressable onPress={() => setFlash(flash === 'off' ? 'on' : 'off')} style={styles.sideButton}>
          <Ionicons name={flash === 'off' ? 'flash-off' : 'flash'} size={24} color="#ffffff" />
        </Pressable>

        <Pressable onPress={onCapture} disabled={capturing} style={styles.shutterOuter}>
          <View style={styles.shutterInner} />
        </Pressable>

        <Pressable onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} style={styles.sideButton}>
          <Ionicons name="camera-reverse-outline" size={26} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000000' },
  closeButton: {
    position: 'absolute',
    left: Spacing.three,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  controlsRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.five,
  },
  sideButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
  },
  previewControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Spacing.four,
  },
  previewButton: { alignItems: 'center', gap: 4 },
  previewButtonText: { color: '#ffffff' },
  permissionScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  permissionIcon: { marginBottom: Spacing.two },
  centeredText: { textAlign: 'center' },
  permissionButton: { marginTop: Spacing.three, alignSelf: 'stretch' },
  permissionCancel: { marginTop: Spacing.three },
});
