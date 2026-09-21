import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/form-header';
import { HeaderIconButton } from '@/components/header-icon-button';
import { MetadataChip } from '@/components/metadata-chip';
import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteDateIdea,
  fetchCoupleDateIdeas,
  fetchDateIdeaTemplates,
  fetchStars,
  starDateIdea,
  unstarDateIdea,
} from '@/lib/date-ideas';
import type { CostLevel, CoupleDateIdea, DateIdeaCategory, DateIdeaMode, DateIdeaSetting, DateIdeaStar, DateIdeaTemplate, TimeOfDay } from '@/lib/database-types';

// port of features/dateideas/dateideasbrowseview.swift — curated + couple-created ideas, split
// by virtual/in-person mode, with a shared "bucket list" of starred ideas and a "+" to add your
// own.
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
  isCustom: boolean;
};

const MODES: { id: DateIdeaMode; label: string }[] = [
  { id: 'virtual', label: 'Virtual' },
  { id: 'in_person', label: 'In person' },
];
const CATEGORY_LABEL: Record<DateIdeaCategory, string> = {
  food: 'Food',
  adventure: 'Adventure',
  cozy: 'Cozy',
  creative: 'Creative',
  games: 'Games',
};
const CATEGORY_ICON: Record<DateIdeaCategory, keyof typeof Ionicons.glyphMap> = {
  food: 'restaurant',
  adventure: 'walk',
  cozy: 'home',
  creative: 'color-palette',
  games: 'game-controller',
};
const COST_LABEL: Record<CostLevel, string> = { free: 'Free', low: '$', medium: '$$', high: '$$$' };
const SETTING_LABEL: Record<DateIdeaSetting, string> = { indoor: 'Indoor', outdoor: 'Outdoor', either: 'Anywhere' };
const TIME_LABEL: Record<TimeOfDay, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', any: 'Anytime' };

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) return hours === 1 ? '1 hr' : `${hours} hrs`;
  return `${hours}h ${remainder}m`;
}

type StarInfo = { starredByMe: boolean; starredByPartner: boolean };

function starInfoFor(idea: Idea, stars: DateIdeaStar[], userId: string | null, partnerId: string | null): StarInfo {
  const relevant = stars.filter((s) => (idea.isCustom ? s.couple_idea_id === idea.id : s.template_id === idea.id));
  return {
    starredByMe: !!userId && relevant.some((s) => s.user_id === userId),
    starredByPartner: !!partnerId && relevant.some((s) => s.user_id === partnerId),
  };
}

function badgeLabel(info: StarInfo): string | null {
  if (info.starredByMe && info.starredByPartner) return 'You both want this';
  if (info.starredByMe) return 'Your pick';
  if (info.starredByPartner) return "Partner's pick";
  return null;
}

export default function DateIdeasScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, couple } = useSession();
  const [templates, setTemplates] = useState<DateIdeaTemplate[]>([]);
  const [coupleIdeas, setCoupleIdeas] = useState<CoupleDateIdea[]>([]);
  const [stars, setStars] = useState<DateIdeaStar[]>([]);
  const [selectedMode, setSelectedMode] = useState<DateIdeaMode>('in_person');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user.id ?? null;
  const partnerId = couple?.partnerId ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templateRows, ideaRows, starRows] = await Promise.all([
        fetchDateIdeaTemplates(),
        couple ? fetchCoupleDateIdeas(couple.id) : Promise.resolve([]),
        couple ? fetchStars(couple.id) : Promise.resolve([]),
      ]);
      setTemplates(templateRows);
      setCoupleIdeas(ideaRows);
      setStars(starRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load date ideas');
    } finally {
      setLoading(false);
    }
  }, [couple]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const allIdeas = useMemo<Idea[]>(
    () => [...coupleIdeas.map((c) => ({ ...c, isCustom: true })), ...templates.map((t) => ({ ...t, isCustom: false }))],
    [coupleIdeas, templates]
  );

  const bucketListIdeas = useMemo(() => {
    return allIdeas
      .map((idea) => ({ idea, info: starInfoFor(idea, stars, userId, partnerId) }))
      .filter(({ info }) => info.starredByMe || info.starredByPartner)
      .sort((a, b) => {
        const rank = (info: StarInfo) => (info.starredByMe && info.starredByPartner ? 0 : info.starredByMe ? 1 : 2);
        const diff = rank(a.info) - rank(b.info);
        return diff !== 0 ? diff : a.idea.title.localeCompare(b.idea.title);
      });
  }, [allIdeas, stars, userId, partnerId]);

  const customIdeas = coupleIdeas.filter((i) => i.mode === selectedMode).map((c) => ({ ...c, isCustom: true }) as Idea);
  const curatedIdeas = templates.filter((i) => i.mode === selectedMode).map((t) => ({ ...t, isCustom: false }) as Idea);

  async function onToggleStar(idea: Idea) {
    if (!couple || !userId) return;
    const existing = stars.find(
      (s) => s.user_id === userId && (idea.isCustom ? s.couple_idea_id === idea.id : s.template_id === idea.id)
    );
    try {
      if (existing) {
        setStars((prev) => prev.filter((s) => s.id !== existing.id));
        await unstarDateIdea(existing.id);
      } else {
        await starDateIdea(couple.id, idea.isCustom ? null : idea.id, idea.isCustom ? idea.id : null);
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your bucket list');
      await load();
    }
  }

  async function onDelete(idea: Idea) {
    setCoupleIdeas((prev) => prev.filter((c) => c.id !== idea.id));
    try {
      await deleteDateIdea(idea.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this idea');
      await load();
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader
        title="Date ideas"
        rightSlot={
          <HeaderIconButton
            icon="add"
            onPress={() => router.push({ pathname: '/date-idea-form', params: { initialMode: selectedMode } })}
          />
        }
      />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        {loading ? (
          <ThemedText type="default" themeColor="textSecondary">
            Loading…
          </ThemedText>
        ) : (
          <>
            {bucketListIdeas.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="star" size={13} color={theme.accent} />
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Bucket list
                  </ThemedText>
                </View>
                {bucketListIdeas.map(({ idea, info }) => (
                  <IdeaRow
                    key={idea.id}
                    idea={idea}
                    info={info}
                    onToggleStar={() => onToggleStar(idea)}
                    onDelete={idea.isCustom ? () => onDelete(idea) : undefined}
                    theme={theme}
                  />
                ))}
              </View>
            ) : null}

            <View style={[styles.segmented, { backgroundColor: theme.backgroundSecondary }]}>
              {MODES.map((m) => (
                <Pressable key={m.id} onPress={() => setSelectedMode(m.id)} style={styles.segmentWrap}>
                  <View style={[styles.segment, selectedMode === m.id && { backgroundColor: theme.surface }]}>
                    <ThemedText type="bodyBold" numberOfLines={1}>
                      {m.label}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>

            {customIdeas.length === 0 && curatedIdeas.length === 0 ? (
              <NBCard>
                <ThemedText type="small" themeColor="textSecondary">
                  No {MODES.find((m) => m.id === selectedMode)?.label.toLowerCase()} ideas yet. Add your own with the + button.
                </ThemedText>
              </NBCard>
            ) : null}

            {customIdeas.length > 0 ? (
              <View style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Yours
                </ThemedText>
                {customIdeas.map((idea) => (
                  <IdeaRow
                    key={idea.id}
                    idea={idea}
                    info={starInfoFor(idea, stars, userId, partnerId)}
                    onToggleStar={() => onToggleStar(idea)}
                    onDelete={() => onDelete(idea)}
                    theme={theme}
                  />
                ))}
              </View>
            ) : null}

            {curatedIdeas.length > 0 ? (
              <View style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Curated
                </ThemedText>
                {curatedIdeas.map((idea) => (
                  <IdeaRow
                    key={idea.id}
                    idea={idea}
                    info={starInfoFor(idea, stars, userId, partnerId)}
                    onToggleStar={() => onToggleStar(idea)}
                    theme={theme}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}

        {error ? (
          <ThemedText type="small" themeColor="destructive">
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function IdeaRow({
  idea,
  info,
  onToggleStar,
  onDelete,
  theme,
}: {
  idea: Idea;
  info: StarInfo;
  onToggleStar: () => void;
  onDelete?: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const label = badgeLabel(info);
  return (
    <NBCard style={styles.ideaCard}>
      <View style={styles.ideaTitleRow}>
        <ThemedText type="default" style={styles.ideaTitle}>
          {idea.title}
        </ThemedText>
        {onDelete ? (
          <Pressable onPress={onDelete} hitSlop={8}>
            <Ionicons name="trash" size={16} color={theme.destructive} />
          </Pressable>
        ) : null}
        <Pressable onPress={onToggleStar} hitSlop={8}>
          <Ionicons name={info.starredByMe ? 'star' : 'star-outline'} size={18} color={theme.accent} />
        </Pressable>
      </View>
      {label ? <MetadataChip icon="star" label={label} /> : null}
      {idea.summary ? (
        <ThemedText type="small" themeColor="textSecondary">
          {idea.summary}
        </ThemedText>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metadataRow}>
        <MetadataChip icon={CATEGORY_ICON[idea.category]} label={CATEGORY_LABEL[idea.category]} />
        <MetadataChip label={COST_LABEL[idea.cost_level]} />
        {idea.duration_minutes ? <MetadataChip icon="time" label={durationLabel(idea.duration_minutes)} /> : null}
        {idea.setting ? <MetadataChip label={SETTING_LABEL[idea.setting]} /> : null}
        {idea.time_of_day ? <MetadataChip label={TIME_LABEL[idea.time_of_day]} /> : null}
      </ScrollView>
    </NBCard>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  segmentWrap: { flex: 1 },
  segment: { paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  section: { gap: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ideaCard: { gap: 8 },
  ideaTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  ideaTitle: { flex: 1, fontWeight: '600' },
  metadataRow: { flexDirection: 'row', gap: 6 },
});
