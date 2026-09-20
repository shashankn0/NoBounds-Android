import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/form-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import type { PromptTemplate } from '@/lib/database-types';
import { fetchPromptTemplates, sendPrompt } from '@/lib/prompts';

// the "+" sheet on the Chat tab. no swift source exists for it yet, so it's built from
// screenshots plus the live schema: a prompt is just a prompt_messages row with kind='prompt',
// either typed by the user ("Write your own") or copied from prompt_templates ("From the catalog").
export default function SendPromptScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { coupleId } = useLocalSearchParams<{ coupleId: string }>();

  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [customText, setCustomText] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPromptTemplates()
      .then(setTemplates)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the catalog'))
      .finally(() => setLoading(false));
  }, []);

  async function onSend(body: string, busyKey: string) {
    if (!coupleId || sendingId) return;
    setSendingId(busyKey);
    setError(null);
    try {
      await sendPrompt(coupleId, body);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that prompt');
      setSendingId(null);
    }
  }

  const trimmedCustom = customText.trim();

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader title="Send a prompt" leftLabel="Cancel" onLeftPress={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
          Write your own
        </ThemedText>
        <View style={styles.customRow}>
          <TextInput
            placeholder="Ask your partner anything…"
            placeholderTextColor={theme.textSecondary}
            value={customText}
            onChangeText={setCustomText}
            multiline
            style={[styles.customInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
          />
          <Pressable
            onPress={() => onSend(trimmedCustom, 'custom')}
            disabled={!trimmedCustom || !!sendingId}
            hitSlop={8}
            style={styles.customSend}>
            {sendingId === 'custom' ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <Ionicons name="arrow-up-circle" size={34} color={trimmedCustom && !sendingId ? theme.accent : theme.textSecondary} />
            )}
          </Pressable>
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={[styles.sectionLabel, styles.catalogLabel]}>
          From the catalog
        </ThemedText>
        {loading ? (
          <ActivityIndicator color={theme.accent} style={styles.catalogLoading} />
        ) : (
          <View style={[styles.catalogCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            {templates.map((template, index) => (
              <View
                key={template.id}
                style={[styles.catalogRow, index > 0 && { borderTopWidth: 1, borderTopColor: theme.separator }]}>
                <ThemedText type="default" style={styles.catalogText}>
                  {template.body}
                </ThemedText>
                <Pressable onPress={() => onSend(template.body, template.id)} disabled={!!sendingId} hitSlop={8}>
                  {sendingId === template.id ? (
                    <ActivityIndicator color={theme.accent} />
                  ) : (
                    <Ionicons name="arrow-up-circle-outline" size={26} color={theme.accent} />
                  )}
                </Pressable>
              </View>
            ))}
          </View>
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

const styles = StyleSheet.create({
  container: { padding: 20, gap: 8 },
  sectionLabel: { marginBottom: 4 },
  catalogLabel: { marginTop: 16 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customInput: { flex: 1, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, minHeight: 48 },
  customSend: { paddingBottom: 2 },
  catalogLoading: { marginTop: 12 },
  catalogCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  catalogRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  catalogText: { flex: 1 },
});
