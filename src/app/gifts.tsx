import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { fetchCoupleGiftIdeas, fetchGiftIdeaTemplates } from '@/lib/gift-ideas';
import type { CoupleGiftIdea, GiftIdeaTemplate } from '@/lib/database-types';

type Row = { id: string; title: string; recipient: string };

export default function GiftsScreen() {
  const { couple } = useSession();
  const [templates, setTemplates] = useState<GiftIdeaTemplate[]>([]);
  const [coupleIdeas, setCoupleIdeas] = useState<CoupleGiftIdea[]>([]);
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

  const rows: Row[] = [
    ...templates.map((t) => ({ id: `template-${t.id}`, title: t.title, recipient: t.recipient })),
    ...coupleIdeas.map((c) => ({ id: `couple-${c.id}`, title: c.title, recipient: c.recipient })),
  ];

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
          renderItem={({ item }) => (
            <NBCard>
              <ThemedText type="default">{item.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
                For {item.recipient}
              </ThemedText>
            </NBCard>
          )}
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
  body: { marginTop: 4 },
});
