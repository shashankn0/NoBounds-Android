import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton, NBSecondaryButton } from '@/components/nb-button';
import { NBListRow } from '@/components/nb-list-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const PRIVACY_URL = 'https://no-bounds-landing-page.vercel.app/privacy';
const TERMS_URL = 'https://no-bounds-landing-page.vercel.app/terms';

// no date-picker library in the project — quick presets keep this simple, matching how
// important-dates' "when" field also just defaults rather than pulling one in
const REUNION_PRESETS = [
  { label: 'In 2 weeks', days: 14 },
  { label: 'In 1 month', days: 30 },
  { label: 'In 3 months', days: 90 },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { couple, signOut } = useSession();
  const [reunionDate, setReunionDate] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (couple) {
        supabase
          .from('couples')
          .select('reunion_start_date')
          .eq('id', couple.id)
          .maybeSingle()
          .then(({ data }) => {
            setReunionDate((data as { reunion_start_date: string | null } | null)?.reunion_start_date ?? null);
          });
      }
    }, [couple])
  );

  // notify-reunion-countdown (real backend, runs hourly) reads this directly — setting it
  // here is the only piece needed to make reunion-countdown notifications actually fire
  async function onSetReunion(days: number | null) {
    if (!couple) return;
    let date: string | null = null;
    if (days !== null) {
      const target = new Date();
      target.setDate(target.getDate() + days);
      date = target.toISOString().slice(0, 10);
    }
    setReunionDate(date);
    await supabase
      .from('couples')
      .update({ reunion_start_date: date, updated_at: new Date().toISOString() })
      .eq('id', couple.id);
  }

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

            <ThemedText type="small" themeColor="textSecondary" style={styles.reunionLabel}>
              {reunionDate
                ? `Reunion set for ${new Date(`${reunionDate}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`
                : 'No reunion date set'}
            </ThemedText>
            <View style={styles.presetRow}>
              {REUNION_PRESETS.map((preset) => (
                <Pressable
                  key={preset.label}
                  onPress={() => onSetReunion(preset.days)}
                  style={[styles.hourChip, { borderColor: theme.border }]}>
                  <ThemedText type="small">{preset.label}</ThemedText>
                </Pressable>
              ))}
              {reunionDate ? (
                <Pressable onPress={() => onSetReunion(null)} style={[styles.hourChip, { borderColor: theme.border }]}>
                  <ThemedText type="small">Clear</ThemedText>
                </Pressable>
              ) : null}
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
        <NBListRow icon="notifications" title="Notifications" onPress={() => router.push('/notifications')} />
        <NBListRow icon="person-circle" title="Account" onPress={() => router.push('/account')} />
      </NBCard>

      <NBCard style={styles.rowsCard}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.cardLabel}>
          Legal
        </ThemedText>
        <NBListRow icon="hand-left" title="Privacy Policy" onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} />
        <NBListRow icon="document-text" title="Terms of Service" onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} />
      </NBCard>

      <NBCard style={styles.rowsCard}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.cardLabel}>
          Your data
        </ThemedText>
        <NBListRow icon="cloud-download" title="Request my data" onPress={() => router.push('/request-data')} />
      </NBCard>

      <NBCard style={styles.rowsCard}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.cardLabel}>
          About
        </ThemedText>
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

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  cardBody: { marginTop: 8 },
  cardButton: { marginTop: 12 },
  cardLabel: { marginBottom: 4 },
  rowsCard: { paddingVertical: 4 },
  reunionLabel: { marginTop: 12, marginBottom: 6 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hourChip: { paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderRadius: 999 },
});
