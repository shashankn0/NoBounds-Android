import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton, NBSecondaryButton } from '@/components/nb-button';
import { NBListRow } from '@/components/nb-list-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';

export default function SettingsScreen() {
  const { couple, signOut } = useSession();

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
      <NBCard>
        <ThemedText type="small" themeColor="textSecondary">
          Partner connection
        </ThemedText>
        {couple ? (
          <>
            <ThemedText type="default" style={styles.cardBody}>
              You are connected. Shared features are available across tabs.
            </ThemedText>
            <View style={styles.cardButton}>
              <NBSecondaryButton title="View pairing" onPress={() => router.push('/pairing')} />
            </View>
          </>
        ) : (
          <>
            <ThemedText type="default" style={styles.cardBody}>
              Create or enter an invite code to connect with your partner.
            </ThemedText>
            <View style={styles.cardButton}>
              <NBPrimaryButton title="Pairing" onPress={() => router.push('/pairing')} />
            </View>
          </>
        )}
      </NBCard>

      <NBCard style={styles.rowsCard}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.cardLabel}>
          Account & preferences
        </ThemedText>
        <NBListRow icon="notifications-outline" title="Notifications" onPress={() => router.push('/notifications')} />
        <NBListRow icon="person-circle-outline" title="Account" />
      </NBCard>

      <NBCard style={styles.rowsCard}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.cardLabel}>
          Legal
        </ThemedText>
        <NBListRow icon="hand-left-outline" title="Privacy Policy" />
        <NBListRow icon="document-text-outline" title="Terms of Service" />
      </NBCard>

      <NBCard style={styles.rowsCard}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.cardLabel}>
          Your data
        </ThemedText>
        <NBListRow icon="cloud-download-outline" title="Request my data" />
      </NBCard>

      <NBCard style={styles.rowsCard}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.cardLabel}>
          About
        </ThemedText>
        <NBListRow icon="heart-outline" title="From the creators" />
      </NBCard>

      <NBCard>
        <NBSecondaryButton title="Sign out" onPress={signOut} />
      </NBCard>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  cardBody: { marginTop: 8 },
  cardButton: { marginTop: 12 },
  cardLabel: { marginBottom: 4 },
  rowsCard: { paddingVertical: 4 },
});
