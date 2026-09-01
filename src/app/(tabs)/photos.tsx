import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { mockPresencePhotos } from '@/lib/mock/photos';

// this is "Bound" in the ios app — presence photos are couple-only, no solo mode
export default function PhotosScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { couple } = useSession();

  if (!couple) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <ScreenHeader />
        <View style={[styles.container, { paddingBottom: insets.bottom + BottomTabInset }]}>
          <NBCard>
            <ThemedText type="title">Partner presence</ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
              Share moments with your partner after you connect. Presence photos are couple-only and do not
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

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScreenHeader centerLabel="Paired with Partner 💛" />
      <FlatList
        data={mockPresencePhotos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + BottomTabInset }]}
        ListHeaderComponent={
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Rough prototype — camera capture &amp; live upload aren&apos;t wired up yet, these are sample
            photos.
          </ThemedText>
        }
        renderItem={({ item }) => (
          <NBCard style={styles.row}>
            <View style={styles.thumb} />
            <View style={styles.rowText}>
              <ThemedText type="default">{item.caption}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                feeling {item.mood}
              </ThemedText>
            </View>
          </NBCard>
        )}
      />

      <Pressable
        onPress={() => router.push('/bound-camera')}
        style={[styles.cameraButton, { bottom: insets.bottom + BottomTabInset, backgroundColor: theme.accent }]}>
        <Ionicons name="camera" size={24} color={theme.textOnAccent} />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  cardBody: { marginTop: 8, marginBottom: 4 },
  cardButton: { marginTop: 8 },
  note: { marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: 'rgba(120,120,120,0.25)' },
  rowText: { flex: 1, gap: 2 },
  cameraButton: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
