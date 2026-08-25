import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { mockPet, petMoodEmoji } from '@/lib/mock/pet';

// static mock data, no backend — real version needs a shared couple pet table
export default function PetScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.emoji}>{petMoodEmoji[mockPet.mood]}</ThemedText>
      <ThemedText type="title">{mockPet.name}</ThemedText>
      <ThemedText type="default" themeColor="textSecondary">
        Level {mockPet.level} · Feeling {mockPet.mood}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  emoji: { fontSize: 96 },
});
