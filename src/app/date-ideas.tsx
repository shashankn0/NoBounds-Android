import { FlatList, StyleSheet } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { mockDateIdeas } from '@/lib/mock/date-ideas';

export default function DateIdeasScreen() {
  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={mockDateIdeas}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <NBCard>
            <ThemedText type="default">
              {item.starred ? '⭐ ' : ''}
              {item.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
              {item.mode === 'virtual' ? 'Virtual' : 'In person'}
            </ThemedText>
          </NBCard>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four },
  list: { gap: Spacing.three },
  body: { marginTop: 4 },
});
