import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/form-header';
import { MetadataChip } from '@/components/metadata-chip';
import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import type { CostLevel, CoupleGiftIdea, GiftIdeaTemplate, GiftKind, GiftRecipient } from '@/lib/database-types';
import { deleteGiftIdea, fetchCoupleGiftIdeas, fetchGiftIdeaTemplates } from '@/lib/gift-ideas';

// port of features/gifts/giftideasbrowseview.swift — curated + couple-created ideas, split by
// kind (gift / act of service), filterable by recipient, with a "+" to add your own.
type Idea = { id: string; title: string; summary: string | null; kind: GiftKind; recipient: GiftRecipient; cost_level: CostLevel; isCustom: boolean };

const KINDS: { id: GiftKind; label: string }[] = [
  { id: 'gift', label: 'Gifts' },
  { id: 'act_of_service', label: 'Acts of service' },
];
const KIND_LABEL: Record<GiftKind, string> = { gift: 'Gift', act_of_service: 'Act of service' };
const KIND_ICON: Record<GiftKind, keyof typeof Ionicons.glyphMap> = { gift: 'gift', act_of_service: 'sparkles' };
const RECIPIENTS: GiftRecipient[] = ['boy', 'girl', 'other'];
const RECIPIENT_LABEL: Record<GiftRecipient, string> = { boy: 'Boy', girl: 'Girl', other: 'Other' };
const RECIPIENT_ICON: Record<GiftRecipient, keyof typeof Ionicons.glyphMap> = { boy: 'man', girl: 'woman', other: 'person' };
// matches ios's DateIdeaCostLevel.displayLabel exactly — gift ideas reuse that same enum
const COST_LABEL: Record<CostLevel, string> = { free: 'Free', low: '$', medium: '$$', high: '$$$' };

export default function GiftsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { couple } = useSession();
  const [templates, setTemplates] = useState<GiftIdeaTemplate[]>([]);
  const [coupleIdeas, setCoupleIdeas] = useState<CoupleGiftIdea[]>([]);
  const [selectedKind, setSelectedKind] = useState<GiftKind>('gift');
  const [selectedRecipient, setSelectedRecipient] = useState<GiftRecipient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templateRows, ideaRows] = await Promise.all([
        fetchGiftIdeaTemplates(),
        couple ? fetchCoupleGiftIdeas(couple.id) : Promise.resolve([]),
      ]);
      setTemplates(templateRows);
      setCoupleIdeas(ideaRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load gift ideas');
    } finally {
      setLoading(false);
    }
  }, [couple]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function matches(idea: { kind: GiftKind; recipient: GiftRecipient }): boolean {
    return idea.kind === selectedKind && (selectedRecipient === null || idea.recipient === selectedRecipient);
  }

  const customIdeas = useMemo<Idea[]>(
    () => coupleIdeas.filter(matches).map((c) => ({ ...c, isCustom: true })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coupleIdeas, selectedKind, selectedRecipient]
  );
  const curatedIdeas = useMemo<Idea[]>(
    () => templates.filter(matches).map((t) => ({ ...t, isCustom: false })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [templates, selectedKind, selectedRecipient]
  );

  async function onDelete(idea: Idea) {
    setCoupleIdeas((prev) => prev.filter((c) => c.id !== idea.id));
    try {
      await deleteGiftIdea(idea.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this idea');
      await load();
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader
        title="Gifts & acts of service"
        titleAlign="left"
        rightSlot={
          <View style={[styles.headerPill, { backgroundColor: theme.surface }]}>
            <Pressable
              onPress={() => router.push({ pathname: '/gift-idea-form', params: { initialKind: selectedKind } })}
              style={styles.headerPillHalf}
              hitSlop={6}>
              <Ionicons name="add" size={20} color={theme.accent} />
            </Pressable>
            <View style={[styles.headerPillDivider, { backgroundColor: theme.border }]} />
            <Pressable onPress={() => router.back()} style={styles.headerPillHalf} hitSlop={6}>
              <ThemedText type="smallBold" themeColor="accent">
                Done
              </ThemedText>
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.segmented, { backgroundColor: theme.backgroundSecondary }]}>
          {KINDS.map((k) => (
            <Pressable key={k.id} onPress={() => setSelectedKind(k.id)} style={styles.segmentWrap}>
              <View style={[styles.segment, selectedKind === k.id && { backgroundColor: theme.surface }]}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {k.label}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <RecipientChip label="All" active={selectedRecipient === null} onPress={() => setSelectedRecipient(null)} theme={theme} />
          {RECIPIENTS.map((r) => (
            <RecipientChip
              key={r}
              label={RECIPIENT_LABEL[r]}
              active={selectedRecipient === r}
              onPress={() => setSelectedRecipient(r)}
              theme={theme}
            />
          ))}
        </ScrollView>

        {loading ? (
          <ThemedText type="default" themeColor="textSecondary">
            Loading…
          </ThemedText>
        ) : (
          <>
            {customIdeas.length === 0 && curatedIdeas.length === 0 ? (
              <NBCard>
                <ThemedText type="small" themeColor="textSecondary">
                  No {KIND_LABEL[selectedKind].toLowerCase()}s here yet. Add your own with the + button.
                </ThemedText>
              </NBCard>
            ) : null}

            {customIdeas.length > 0 ? (
              <View style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Yours
                </ThemedText>
                {customIdeas.map((idea) => (
                  <IdeaRow key={idea.id} idea={idea} onDelete={() => onDelete(idea)} theme={theme} />
                ))}
              </View>
            ) : null}

            {curatedIdeas.length > 0 ? (
              <View style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Curated
                </ThemedText>
                {curatedIdeas.map((idea) => (
                  <IdeaRow key={idea.id} idea={idea} theme={theme} />
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

function RecipientChip({
  label,
  active,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.recipientChip,
        { backgroundColor: active ? theme.accent : theme.surfaceElevated, borderColor: theme.border, borderWidth: active ? 0 : 1 },
      ]}>
      <ThemedText style={[styles.recipientChipText, { color: active ? theme.textOnAccent : theme.textPrimary }]}>{label}</ThemedText>
    </Pressable>
  );
}

function IdeaRow({ idea, onDelete, theme }: { idea: Idea; onDelete?: () => void; theme: ReturnType<typeof useTheme> }) {
  return (
    <NBCard style={styles.ideaCard}>
      <View style={styles.ideaTitleRow}>
        <ThemedText type="default" style={styles.ideaTitle}>
          {idea.title}
        </ThemedText>
        {idea.isCustom && onDelete ? (
          <Pressable onPress={onDelete} hitSlop={8}>
            <Ionicons name="trash" size={16} color={theme.destructive} />
          </Pressable>
        ) : null}
      </View>
      {idea.summary ? (
        <ThemedText type="small" themeColor="textSecondary">
          {idea.summary}
        </ThemedText>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metadataRow}>
        <MetadataChip icon={KIND_ICON[idea.kind]} label={KIND_LABEL[idea.kind]} />
        <MetadataChip icon={RECIPIENT_ICON[idea.recipient]} label={`For: ${RECIPIENT_LABEL[idea.recipient]}`} />
        <MetadataChip label={COST_LABEL[idea.cost_level]} />
      </ScrollView>
    </NBCard>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  segmentWrap: { flex: 1 },
  segment: { paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  chipRow: { flexDirection: 'row', gap: 6 },
  recipientChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  recipientChipText: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  section: { gap: 10 },
  headerPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, overflow: 'hidden' },
  headerPillHalf: { paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  headerPillDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 8 },
  ideaCard: { gap: 8 },
  ideaTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  ideaTitle: { flex: 1, fontWeight: '600' },
  metadataRow: { flexDirection: 'row', gap: 6 },
});
