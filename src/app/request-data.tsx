import { Linking, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton, NBSecondaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// real support inbox, per the actual app's help center page
const SUPPORT_EMAIL = 'shaan.m.patel1@gmail.com';

export default function RequestDataScreen() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader title="Request my data" leftLabel="Close" onLeftPress={() => router.back()} />
      <ThemedView style={styles.container}>
        <NBCard>
          <ThemedText type="title">Request my data</ThemedText>
          <ThemedText type="default" style={styles.body}>
            We can provide a copy of the personal data associated with your account. Submit a request and our team
            will respond by email.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
            Our team will prepare your export and respond by email.
          </ThemedText>
        </NBCard>

        <NBPrimaryButton
          title="Email support"
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Data export request')}`)}
        />
        <NBSecondaryButton title="Done" onPress={() => router.back()} />
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  body: { marginTop: Spacing.two },
  caption: { marginTop: Spacing.two },
});
