import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// real content, copied verbatim from the ios app's "From the creators" screen
export default function AboutScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        <NBCard style={styles.centered}>
          <View style={[styles.iconBadge, { backgroundColor: theme.accentMuted }]}>
            <Ionicons name="heart" size={24} color={theme.textOnAccent} />
          </View>
          <ThemedText type="title" style={styles.centeredText}>
            A love letter, turned into an app
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            Every feature here exists because we wanted a better way to stay close — and we hope it feels that way
            for you too.
          </ThemedText>
        </NBCard>

        <NBCard>
          <ThemedText type="default" style={styles.paragraph}>
            No Bounds began as a love letter between us — Shaan and Reva — two people who wanted to feel close even
            when miles kept us apart.
          </ThemedText>
          <ThemedText type="default" style={styles.paragraph}>
            We built this app with the same care we put into our relationship: thoughtful check-ins, little moments
            shared, and a space that&apos;s just for the two of you.
          </ThemedText>
          <ThemedText type="default" style={styles.paragraph}>
            We&apos;re passionate about creating something warm and intentional — not another noisy feed, but a
            private corner built for couples who choose each other every day.
          </ThemedText>
          <ThemedText type="default" style={styles.paragraph}>
            Thank you for letting us be part of yours.
          </ThemedText>
        </NBCard>

        <NBCard style={styles.attributionRow}>
          <Ionicons name="heart" size={20} color={theme.accent} />
          <View>
            <ThemedText type="smallBold">Shaan Patel &amp; Reva Bagi</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Creators of No Bounds
            </ThemedText>
          </View>
        </NBCard>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  centered: { alignItems: 'center', gap: Spacing.two },
  centeredText: { textAlign: 'center' },
  iconBadge: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  paragraph: { marginBottom: Spacing.three },
  attributionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
