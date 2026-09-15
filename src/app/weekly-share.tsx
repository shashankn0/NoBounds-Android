import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import type { CoupleWeeklyShare, WeeklyShareKind } from '@/lib/database-types';
import { supabase } from '@/lib/supabase';
import { fetchThisWeeksShare } from '@/lib/weekly-share';

const KINDS: { id: WeeklyShareKind; label: string }[] = [
  { id: 'message', label: 'Message' },
  { id: 'quote', label: 'Quote' },
  { id: 'link', label: 'Link' },
];

export default function WeeklyShareScreen() {
  const theme = useTheme();
  const { session, couple } = useSession();
  const [share, setShare] = useState<CoupleWeeklyShare | null>(null);
  const [kind, setKind] = useState<WeeklyShareKind>('message');
  const [draft, setDraft] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!couple) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setShare(await fetchThisWeeksShare(couple.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this week’s share');
    } finally {
      setLoading(false);
    }
  }, [couple]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onPost() {
    if (!couple || !session || draft.trim().length === 0) return;
    setSaving(true);
    setError(null);
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const { error: insertError } = await supabase.from('couple_weekly_shares').insert({
      couple_id: couple.id,
      created_by: session.user.id,
      week_start: startOfWeek.toISOString().slice(0, 10),
      kind,
      body: draft.trim(),
      url: kind === 'link' ? url.trim() || null : null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDraft('');
    setUrl('');
    await load();
  }

  if (!couple) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="default" themeColor="textSecondary">
          Weekly share unlocks once you connect with your partner.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {loading ? (
        <ThemedText type="default" themeColor="textSecondary">
          Loading…
        </ThemedText>
      ) : share ? (
        <NBCard>
          <ThemedText type="title" style={styles.quote}>
            {share.body}
          </ThemedText>
          {share.kind === 'link' && share.url ? (
            <ThemedText type="link" themeColor="accent" style={styles.body}>
              {share.url}
            </ThemedText>
          ) : null}
        </NBCard>
      ) : (
        <NBCard>
          <ThemedText type="default" themeColor="textSecondary">
            Nobody&apos;s shared anything this week yet.
          </ThemedText>
          <View style={styles.kindRow}>
            {KINDS.map((k) => {
              const active = kind === k.id;
              return (
                <Pressable
                  key={k.id}
                  onPress={() => setKind(k.id)}
                  style={[
                    styles.kindChip,
                    { borderColor: active ? theme.accent : theme.border },
                    active && { backgroundColor: theme.accentMuted },
                  ]}>
                  <ThemedText type="small">{k.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            placeholder={kind === 'quote' ? 'A quote worth sharing' : kind === 'link' ? "What's this link about?" : 'A message for the two of you'}
            placeholderTextColor={theme.textSecondary}
            value={draft}
            onChangeText={setDraft}
            multiline
            style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
          />
          {kind === 'link' ? (
            <TextInput
              placeholder="https://…"
              placeholderTextColor={theme.textSecondary}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
              style={[styles.input, styles.urlInput, { color: theme.textPrimary, borderColor: theme.border }]}
            />
          ) : null}
          <View style={styles.button}>
            <NBPrimaryButton title={saving ? 'Posting…' : 'Post'} onPress={onPost} disabled={saving || draft.trim().length === 0} />
          </View>
        </NBCard>
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
  container: { flex: 1, padding: Spacing.four, justifyContent: 'center', gap: Spacing.two },
  quote: { fontSize: 24, lineHeight: 32 },
  body: { marginTop: 8 },
  kindRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  kindChip: { paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderRadius: 999 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 15 },
  urlInput: { minHeight: 0, textAlignVertical: 'center' },
  button: { marginTop: 12 },
});
