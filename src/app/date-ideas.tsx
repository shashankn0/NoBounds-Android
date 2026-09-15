import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { fetchCoupleDateIdeas, fetchDateIdeaTemplates, fetchStars, starDateIdea, unstarDateIdea } from '@/lib/date-ideas';
import type { CoupleDateIdea, DateIdeaStar, DateIdeaTemplate } from '@/lib/database-types';

type Row = { id: string; title: string; mode: string; templateId: string | null; coupleIdeaId: string | null };

export default function DateIdeasScreen() {
  const theme = useTheme();
  const { couple } = useSession();
  const [templates, setTemplates] = useState<DateIdeaTemplate[]>([]);
  const [coupleIdeas, setCoupleIdeas] = useState<CoupleDateIdea[]>([]);
  const [stars, setStars] = useState<DateIdeaStar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const rows: Row[] = [
    ...templates.map((t) => ({ id: `template-${t.id}`, title: t.title, mode: t.mode, templateId: t.id, coupleIdeaId: null })),
    ...coupleIdeas.map((c) => ({ id: `couple-${c.id}`, title: c.title, mode: c.mode, templateId: null, coupleIdeaId: c.id })),
  ];

  async function onToggleStar(row: Row) {
    if (!couple) return;
    const existing = stars.find((s) => s.template_id === row.templateId && s.couple_idea_id === row.coupleIdeaId);
    try {
      if (existing) {
        await unstarDateIdea(existing.id);
      } else {
        await starDateIdea(couple.id, row.templateId, row.coupleIdeaId);
      }
      await load();
    } catch {
      // starring is a nice-to-have — silently ignore, list just won't update
    }
  }

  return (
    <ThemedView style={styles.container}>
      {loading ? (
        <ThemedText type="default" themeColor="textSecondary">
          Loading…
        </ThemedText>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const starred = stars.some((s) => s.template_id === item.templateId && s.couple_idea_id === item.coupleIdeaId);
            return (
              <Pressable onPress={() => onToggleStar(item)}>
                <NBCard style={styles.row}>
                  <View style={styles.rowText}>
                    <ThemedText type="default">{item.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.rowSubtitle}>
                      {item.mode === 'virtual' ? 'Virtual' : 'In person'}
                    </ThemedText>
                  </View>
                  <Ionicons
                    name={starred ? 'star' : 'star-outline'}
                    size={18}
                    color={starred ? theme.accent : theme.textSecondary}
                  />
                </NBCard>
              </Pressable>
            );
          }}
        />
      )}
      {error ? (
        <ThemedText type="small" themeColor="destructive">
          {error}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four },
  list: { gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { flex: 1 },
  rowSubtitle: { marginTop: 2 },
});
