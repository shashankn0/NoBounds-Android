import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { mockWeeklyShare } from '@/lib/mock/weekly-share';

export default function WeeklyShareScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.quote}>
        {mockWeeklyShare.quote}
      </ThemedText>
      <ThemedText type="default" themeColor="textSecondary">
        Shared by {mockWeeklyShare.sharedBy}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, justifyContent: 'center', gap: Spacing.two },
  quote: { fontSize: 24, lineHeight: 32 },
});
