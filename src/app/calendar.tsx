import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function CalendarScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.heading}>
        Habits
      </ThemedText>
      <NBCard style={styles.centered}>
        <Ionicons name="checkmark-done-circle-outline" size={40} color={theme.accent} style={styles.icon} />
        <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
          No habits added yet. Habits you and your partner track together will show up here.
        </ThemedText>
      </NBCard>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four },
  heading: { marginBottom: Spacing.two },
  centered: { alignItems: 'center', gap: 4 },
  centeredText: { textAlign: 'center' },
  icon: { marginBottom: 4 },
});
