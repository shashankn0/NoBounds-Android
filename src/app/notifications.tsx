import { FlatList, StyleSheet } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { mockNotifications } from '@/lib/mock/notifications';

export default function NotificationsScreen() {
  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={mockNotifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <NBCard elevated={!item.read}>
            <ThemedText type="smallBold">{item.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
              {item.body}
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
