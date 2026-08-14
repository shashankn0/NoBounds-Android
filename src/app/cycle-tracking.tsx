import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { mockCycle } from '@/lib/mock/cycle-tracking';

export default function CycleTrackingScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Day {mockCycle.currentDay}</ThemedText>
      <ThemedText type="default" themeColor="textSecondary">
        {mockCycle.phase} phase · {mockCycle.cycleLength}-day cycle
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Sharing with partner: {mockCycle.sharingEnabled ? 'on' : 'off'}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, gap: Spacing.two },
});
