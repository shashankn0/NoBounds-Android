import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MetadataChip } from '@/components/metadata-chip';
import { NBCard } from '@/components/nb-card';
import { NBSecondaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { CostLevel, GiftKind, GiftRecipient } from '@/lib/database-types';
import { fetchCoupleGiftIdeas, fetchGiftIdeaTemplates } from '@/lib/gift-ideas';

type Idea = { id: string; title: string; summary: string | null; kind: GiftKind; recipient: GiftRecipient; cost_level: CostLevel };

const KIND_ICON: Record<GiftKind, keyof typeof Ionicons.glyphMap> = { gift: 'gift', act_of_service: 'sparkles' };
const KIND_LABEL: Record<GiftKind, string> = { gift: 'Gift', act_of_service: 'Act of service' };
const RECIPIENT_LABEL: Record<GiftRecipient, string> = { boy: 'For: Boy', girl: 'For: Girl', other: 'For: Anyone' };
const RECIPIENT_ICON: Record<GiftRecipient, keyof typeof Ionicons.glyphMap> = { boy: 'man', girl: 'woman', other: 'person' };
// matches ios's DateIdeaCostLevel.displayLabel exactly — gift ideas reuse that same enum
const COST_LABEL: Record<CostLevel, string> = { free: 'Free', low: '$', medium: '$$', high: '$$$' };

// mirrors ios's HomeGiftIdeasCard — a daily-rotating featured idea with a shuffle
export function HomeGiftIdeasCard({ coupleId }: { coupleId: string }) {
  const theme = useTheme();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [shuffleOffset, setShuffleOffset] = useState(0);
  const [daySeed] = useState(() => Math.floor(Date.now() / 86_400_000));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [templates, coupleIdeas] = await Promise.all([fetchGiftIdeaTemplates(), fetchCoupleGiftIdeas(coupleId)]);
      setIdeas([
        ...templates.map((t) => ({ id: t.id, title: t.title, summary: t.summary, kind: t.kind, recipient: t.recipient, cost_level: t.cost_level })),
        ...coupleIdeas.map((c) => ({ id: c.id, title: c.title, summary: c.summary, kind: c.kind, recipient: c.recipient, cost_level: c.cost_level })),
      ]);
    } catch {
      // this is a home summary card — the full /gifts screen shows the real error state
    } finally {
      setLoading(false);
    }
  }, [coupleId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const featured = useMemo(() => {
    if (ideas.length === 0) return null;
    return ideas[(daySeed + shuffleOffset) % ideas.length];
  }, [ideas, shuffleOffset, daySeed]);

  return (
    <NBCard>
      <View style={styles.headerRow}>
        <ThemedText type="title">Gifts & acts of service</ThemedText>
        <Ionicons name="gift" size={13} color={theme.accent} />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
        Small ways to show up for each other — a surprise gift or a helping hand.
      </ThemedText>

      {loading ? (
        <ThemedText type="default" themeColor="textSecondary" style={styles.body}>
          Loading…
        </ThemedText>
      ) : featured ? (
        <View style={styles.body}>
          <ThemedText type="bodyBold">{featured.title}</ThemedText>
          {featured.summary ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.summary}>
              {featured.summary}
            </ThemedText>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <MetadataChip icon={KIND_ICON[featured.kind]} label={KIND_LABEL[featured.kind]} />
            <MetadataChip icon={RECIPIENT_ICON[featured.recipient]} label={RECIPIENT_LABEL[featured.recipient]} />
            <MetadataChip label={COST_LABEL[featured.cost_level]} />
          </ScrollView>
        </View>
      ) : (
        <ThemedText type="default" themeColor="textSecondary" style={styles.body}>
          No ideas yet — add your own from Browse.
        </ThemedText>
      )}

      <View style={styles.buttonRow}>
        <View style={styles.buttonFlex}>
          <NBSecondaryButton title="Browse all" onPress={() => router.push('/gifts')} />
        </View>
        <Pressable
          onPress={() => setShuffleOffset((n) => n + 1)}
          disabled={ideas.length < 2}
          style={[styles.iconButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, opacity: ideas.length < 2 ? 0.5 : 1 }]}>
          <Ionicons name="shuffle" size={18} color={theme.textPrimary} />
        </Pressable>
      </View>
    </NBCard>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  caption: { marginTop: 4 },
  body: { marginTop: 8, gap: 4 },
  summary: { marginTop: 2 },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  buttonFlex: { flex: 1 },
  iconButton: { width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
});
