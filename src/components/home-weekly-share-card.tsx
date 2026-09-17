import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { NBSecondaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { CoupleWeeklyShare, WeeklyShareKind, WeeklyShareQuote } from '@/lib/database-types';
import { currentWeekStartKey, deleteWeeklyShare, fetchThisWeeksShare, fetchWeeklyShareQuotes, pickWeeklyShareQuote } from '@/lib/weekly-share';

const KIND_ICON: Record<WeeklyShareKind, keyof typeof Ionicons.glyphMap> = {
  message: 'chatbubble-ellipses',
  quote: 'text',
  link: 'link',
};

function hostFor(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// mirrors ios's HomeWeeklyShareCard: this week's share if either partner posted one, else a
// deterministic default quote (same one for both of you until someone shares their own)
export function HomeWeeklyShareCard({ coupleId, currentUserId }: { coupleId: string; currentUserId: string }) {
  const theme = useTheme();
  const [share, setShare] = useState<CoupleWeeklyShare | null>(null);
  const [defaultQuote, setDefaultQuote] = useState<WeeklyShareQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [currentShare, quotes] = await Promise.all([fetchThisWeeksShare(coupleId), fetchWeeklyShareQuotes()]);
      setShare(currentShare);
      setDefaultQuote(pickWeeklyShareQuote(quotes, coupleId, currentWeekStartKey()));
    } catch {
      // this is a home summary card — the full /weekly-share screen shows the real error state
    } finally {
      setLoading(false);
    }
  }, [coupleId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRemove() {
    if (!share) return;
    setRemoving(true);
    try {
      await deleteWeeklyShare(share.id);
      setShare(null);
    } catch {
      // best-effort — card just keeps showing the current share on failure
    } finally {
      setRemoving(false);
    }
  }

  return (
    <NBCard>
      <View style={styles.headerRow}>
        <ThemedText type="title">Weekly share</ThemedText>
        <Ionicons name="chatbox-ellipses" size={13} color={theme.accent} />
      </View>

      {loading ? (
        <ThemedText type="default" themeColor="textSecondary" style={styles.body}>
          Loading…
        </ThemedText>
      ) : share ? (
        <View style={styles.body}>
          <View style={styles.sharedByRow}>
            <Ionicons name={KIND_ICON[share.kind]} size={12} color={theme.accent} />
            <ThemedText type="small" themeColor="textSecondary">
              {share.created_by === currentUserId ? 'Shared by you' : 'Shared by your partner'}
            </ThemedText>
          </View>
          {share.body.length > 0 ? (
            <ThemedText type="default" style={share.kind === 'quote' ? styles.quoteText : undefined}>
              {share.kind === 'quote' ? `“${share.body}”` : share.body}
            </ThemedText>
          ) : null}
          {share.url ? (
            <Pressable onPress={() => Linking.openURL(share.url!)} style={styles.linkRow}>
              <Ionicons name="open-outline" size={13} color={theme.accent} />
              <ThemedText type="link" themeColor="accent" numberOfLines={1}>
                {hostFor(share.url)}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : defaultQuote ? (
        <View style={styles.body}>
          <ThemedText type="default" style={styles.quoteText}>
            “{defaultQuote.body}”
          </ThemedText>
          {defaultQuote.author ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.summary}>
              — {defaultQuote.author}
            </ThemedText>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary" style={styles.summary}>
            This week&apos;s quote — share something of your own to replace it.
          </ThemedText>
        </View>
      ) : (
        <ThemedText type="default" themeColor="textSecondary" style={styles.body}>
          Drop a message, quote, or link for your partner this week.
        </ThemedText>
      )}

      <View style={styles.buttonRow}>
        <View style={styles.buttonFlex}>
          <NBSecondaryButton title={share ? 'Replace' : 'Share something'} onPress={() => router.push('/weekly-share')} />
        </View>
        {share ? (
          <Pressable
            onPress={onRemove}
            disabled={removing}
            style={[styles.trashButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, opacity: removing ? 0.5 : 1 }]}>
            <Ionicons name="trash" size={18} color={theme.textPrimary} />
          </Pressable>
        ) : null}
      </View>
    </NBCard>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  body: { marginTop: 8, gap: 6 },
  sharedByRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quoteText: { fontStyle: 'italic' },
  summary: { marginTop: 6 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  buttonFlex: { flex: 1 },
  trashButton: { width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
});
