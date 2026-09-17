import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MetadataChip } from '@/components/metadata-chip';
import { NBCard } from '@/components/nb-card';
import { NBSecondaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { CostLevel, DateIdeaCategory, DateIdeaMode, DateIdeaSetting, TimeOfDay } from '@/lib/database-types';
import { fetchCoupleDateIdeas, fetchDateIdeaTemplates } from '@/lib/date-ideas';

type Idea = {
  id: string;
  title: string;
  summary: string | null;
  category: DateIdeaCategory;
  mode: DateIdeaMode;
  cost_level: CostLevel;
  duration_minutes: number | null;
  setting: DateIdeaSetting | null;
  time_of_day: TimeOfDay | null;
};

const CATEGORY_ICON: Record<DateIdeaCategory, keyof typeof Ionicons.glyphMap> = {
  food: 'restaurant',
  adventure: 'walk',
  cozy: 'home',
  creative: 'color-palette',
  games: 'game-controller',
};

const CATEGORY_LABEL: Record<DateIdeaCategory, string> = {
  food: 'Food',
  adventure: 'Adventure',
  cozy: 'Cozy',
  creative: 'Creative',
  games: 'Games',
};

const COST_LABEL: Record<CostLevel, string> = { free: 'Free', low: 'Low cost', medium: 'Medium cost', high: 'High cost' };
const SETTING_LABEL: Record<DateIdeaSetting, string> = { indoor: 'Indoor', outdoor: 'Outdoor', either: 'Anywhere' };
const TIME_LABEL: Record<TimeOfDay, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', any: 'Any time' };

function durationLabel(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60} hr` : `${minutes} min`;
}

// mirrors ios's HomeDateIdeasCard, minus the reunion-aware virtual/in-person mode switch —
// android doesn't track a couple's reunion date yet, so this always picks from every idea
export function HomeDateIdeasCard({ coupleId }: { coupleId: string }) {
  const theme = useTheme();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [shuffleOffset, setShuffleOffset] = useState(0);
  const [daySeed] = useState(() => Math.floor(Date.now() / 86_400_000));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [templates, coupleIdeas] = await Promise.all([fetchDateIdeaTemplates(), fetchCoupleDateIdeas(coupleId)]);
      setIdeas([
        ...templates.map((t) => ({
          id: t.id,
          title: t.title,
          summary: t.summary,
          category: t.category,
          mode: t.mode,
          cost_level: t.cost_level,
          duration_minutes: t.duration_minutes,
          setting: t.setting,
          time_of_day: t.time_of_day,
        })),
        ...coupleIdeas.map((c) => ({
          id: c.id,
          title: c.title,
          summary: c.summary,
          category: c.category,
          mode: c.mode,
          cost_level: c.cost_level,
          duration_minutes: c.duration_minutes,
          setting: c.setting,
          time_of_day: c.time_of_day,
        })),
      ]);
    } catch {
      // this is a home summary card — the full /date-ideas screen shows the real error state
    } finally {
      setLoading(false);
    }
  }, [coupleId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // rotates daily so the card changes without extra taps, same idea as the gift-ideas card
  const featured = useMemo(() => {
    if (ideas.length === 0) return null;
    return ideas[(daySeed + shuffleOffset) % ideas.length];
  }, [ideas, shuffleOffset, daySeed]);

  return (
    <NBCard>
      <View style={styles.headerRow}>
        <ThemedText type="title">Date ideas</ThemedText>
        <Ionicons name="heart" size={13} color={theme.accent} />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
        Far apart? Try a virtual date tonight.
      </ThemedText>

      {loading ? (
        <ThemedText type="default" themeColor="textSecondary" style={styles.body}>
          Loading…
        </ThemedText>
      ) : featured ? (
        <View style={styles.body}>
          <ThemedText type="smallBold">{featured.title}</ThemedText>
          {featured.summary ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.summary}>
              {featured.summary}
            </ThemedText>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <MetadataChip icon={CATEGORY_ICON[featured.category]} label={CATEGORY_LABEL[featured.category]} />
            <MetadataChip label={COST_LABEL[featured.cost_level]} />
            {featured.duration_minutes ? <MetadataChip icon="time" label={durationLabel(featured.duration_minutes)} /> : null}
            {featured.setting ? <MetadataChip label={SETTING_LABEL[featured.setting]} /> : null}
            {featured.time_of_day ? <MetadataChip label={TIME_LABEL[featured.time_of_day]} /> : null}
          </ScrollView>
        </View>
      ) : (
        <ThemedText type="default" themeColor="textSecondary" style={styles.body}>
          No ideas yet — add your own from Browse.
        </ThemedText>
      )}

      <View style={styles.buttonRow}>
        <View style={styles.buttonFlex}>
          <NBSecondaryButton title="Browse all" onPress={() => router.push('/date-ideas')} />
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
