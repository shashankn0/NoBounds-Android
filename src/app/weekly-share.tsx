import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import type { WeeklyShareKind } from '@/lib/database-types';
import { normalizedWeeklyShareUrl, upsertWeeklyShare } from '@/lib/weekly-share';

// port of features/weeklyshare/createweeklysharesheet.swift — a compose-only form. it always
// replaces whatever the couple has featured this week, it never shows/edits the existing share
// in place (that read-only view lives on the home card, not here).
const KINDS: { id: WeeklyShareKind; label: string }[] = [
  { id: 'message', label: 'Message' },
  { id: 'quote', label: 'Quote' },
  { id: 'link', label: 'Link' },
];

const BODY_PLACEHOLDER: Record<WeeklyShareKind, string> = {
  message: 'Write something for your partner…',
  quote: "A quote that's been on your mind…",
  link: '',
};

export default function WeeklyShareScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { couple } = useSession();
  const [kind, setKind] = useState<WeeklyShareKind>('message');
  const [bodyText, setBodyText] = useState('');
  const [urlText, setUrlText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedBody = bodyText.trim();
  const normalizedUrl = kind === 'link' ? normalizedWeeklyShareUrl(urlText) : null;
  const canSave = !saving && (kind === 'link' ? normalizedUrl !== null : trimmedBody.length > 0);

  async function onSave() {
    if (!couple || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      await upsertWeeklyShare(couple.id, kind, trimmedBody, kind === 'link' ? normalizedUrl : null);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your share');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader
        title="This week's share"
        leftLabel="Cancel"
        onLeftPress={() => router.back()}
        rightLabel={saving ? 'Saving…' : 'Share'}
        onRightPress={onSave}
        rightDisabled={!canSave}
      />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.segmented, { backgroundColor: theme.backgroundSecondary }]}>
          {KINDS.map((k) => (
            <Pressable key={k.id} onPress={() => setKind(k.id)} style={styles.segmentWrap}>
              <View style={[styles.segment, kind === k.id && { backgroundColor: theme.surface }]}>
                <ThemedText type="smallBold">{k.label}</ThemedText>
              </View>
            </Pressable>
          ))}
        </View>

        <NBCard>
          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
            {kind === 'link' ? 'Link' : KINDS.find((k) => k.id === kind)?.label}
          </ThemedText>
          {kind === 'link' ? (
            <>
              <TextInput
                placeholder="https://…"
                placeholderTextColor={theme.textSecondary}
                value={urlText}
                onChangeText={setUrlText}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
              />
              <TextInput
                placeholder="Caption (optional)"
                placeholderTextColor={theme.textSecondary}
                value={bodyText}
                onChangeText={setBodyText}
                multiline
                style={[styles.input, styles.multilineInput, { color: theme.textPrimary, borderColor: theme.border }]}
              />
            </>
          ) : (
            <TextInput
              placeholder={BODY_PLACEHOLDER[kind]}
              placeholderTextColor={theme.textSecondary}
              value={bodyText}
              onChangeText={setBodyText}
              multiline
              style={[styles.input, styles.multilineInput, { color: theme.textPrimary, borderColor: theme.border }]}
            />
          )}
        </NBCard>

        {error ? (
          <ThemedText type="small" themeColor="destructive">
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  segmentWrap: { flex: 1 },
  segment: { paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  sectionLabel: { marginBottom: 8 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  multilineInput: { minHeight: 90, textAlignVertical: 'top', marginTop: 10 },
});
