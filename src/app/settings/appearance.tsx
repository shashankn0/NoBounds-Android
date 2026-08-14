import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palettes, type PaletteId } from '@/constants/palettes';
import { usePalette } from '@/contexts/palette-context';
import { useTheme } from '@/hooks/use-theme';

const MODES: { id: 'light' | 'dark' | 'system'; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export default function AppearanceScreen() {
  const theme = useTheme();
  const { paletteId, setPaletteId, appearanceMode, setAppearanceMode, isDark } = usePalette();

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.segmented, { backgroundColor: theme.backgroundSecondary }]}>
          {MODES.map((mode) => (
            <Pressable key={mode.id} onPress={() => setAppearanceMode(mode.id)} style={styles.segmentWrap}>
              <View
                style={[
                  styles.segment,
                  appearanceMode === mode.id && { backgroundColor: theme.surface, shadowOpacity: 0.1 },
                ]}>
                <ThemedText type="smallBold">{mode.label}</ThemedText>
              </View>
            </Pressable>
          ))}
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
          Color palette
        </ThemedText>

        {Object.values(Palettes).map((palette) => {
          const colors = palette[isDark ? 'dark' : 'light'];
          const selected = paletteId === palette.id;
          return (
            <Pressable key={palette.id} onPress={() => setPaletteId(palette.id as PaletteId)}>
              <View
                style={[
                  styles.paletteCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: selected ? theme.accent : theme.border,
                    borderWidth: selected ? 2 : 1,
                  },
                ]}>
                <View style={styles.swatchBand}>
                  <View style={[styles.swatchThird, { backgroundColor: colors.background }]} />
                  <View style={[styles.swatchThird, { backgroundColor: colors.accent }]} />
                  <View style={[styles.swatchThird, { backgroundColor: colors.surface }]} />
                </View>
                <View style={styles.paletteFooter}>
                  <ThemedText type="smallBold">{palette.name}</ThemedText>
                  {selected ? (
                    <ThemedText type="default" themeColor="accent">
                      ✓
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}

        <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
          Applies app-wide. Saved on this device and synced when signed in.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 8 },
  segmentWrap: { flex: 1 },
  segment: { paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  sectionLabel: { marginBottom: 4 },
  paletteCard: { borderRadius: 14, overflow: 'hidden' },
  swatchBand: { flexDirection: 'row', height: 80 },
  swatchThird: { flex: 1 },
  paletteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  footer: { marginTop: 8, textAlign: 'center' },
});
