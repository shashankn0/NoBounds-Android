import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton, NBSecondaryButton } from '@/components/nb-button';
import { NBListRow } from '@/components/nb-list-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';

const PRIVACY_URL = 'https://no-bounds-landing-page.vercel.app/privacy';
const TERMS_URL = 'https://no-bounds-landing-page.vercel.app/terms';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { couple, signOut } = useSession();

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
      <NBCard style={styles.section}>
        <ThemedText type="default">Partner connection</ThemedText>
        {couple ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              You are connected. Shared features are available across tabs.
            </ThemedText>
            <NBSecondaryButton title="View pairing" onPress={() => router.push('/pairing')} />
          </>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Create or enter an invite code to connect with your partner.
            </ThemedText>
            <NBPrimaryButton title="Pairing" onPress={() => router.push('/pairing')} />
          </>
        )}
      </NBCard>

      <NBCard style={styles.section}>
        <ThemedText type="default">Account & preferences</ThemedText>
        <NBListRow icon="notifications" title="Notifications" onPress={() => router.push('/notifications')} />
        <NBListRow icon="person-circle" title="Account" onPress={() => router.push('/account')} />
      </NBCard>

      <NBCard style={styles.section}>
        <ThemedText type="default">Legal</ThemedText>
        <NBListRow icon="hand-left" title="Privacy Policy" onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} />
        <NBListRow icon="document-text" title="Terms of Service" onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} />
      </NBCard>

      <NBCard style={styles.section}>
        <ThemedText type="default">Your data</ThemedText>
        <NBListRow icon="cloud-download" title="Request my data" onPress={() => router.push('/request-data')} />
      </NBCard>

      <NBCard style={styles.section}>
        <ThemedText type="default">About</ThemedText>
        <NBListRow icon="heart" title="From the creators" onPress={() => router.push('/about')} />
      </NBCard>

      <NBCard>
        {/* clears the session, session-context routes back to (auth) automatically */}
        <NBSecondaryButton title="Sign out" onPress={signOut} />
      </NBCard>
      </ScrollView>
    </ThemedView>
  );
}

// ios SettingsView: 16 screen padding, 12 between cards, and 12 between a card's own children
const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  section: { gap: 12 },
});
