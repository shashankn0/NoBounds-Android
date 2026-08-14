import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type Answer = { user_id: string; answer_text: string };

export default function PromptScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, couple } = useSession();
  const [promptText, setPromptText] = useState<string | null>(null);
  const [promptId, setPromptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!couple) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: dailyPrompt, error: rpcError } = await supabase
      .rpc('get_or_create_todays_prompt')
      .single();

    if (rpcError || !dailyPrompt) {
      setError(rpcError?.message ?? 'Could not load today’s prompt');
      setLoading(false);
      return;
    }

    const row = dailyPrompt as { id: string; prompt_template_id: string };
    setPromptId(row.id);

    const [{ data: template }, { data: answerRows }] = await Promise.all([
      supabase.from('prompt_templates').select('text').eq('id', row.prompt_template_id).single(),
      supabase.from('prompt_answers').select('user_id, answer_text').eq('couple_daily_prompt_id', row.id),
    ]);

    setPromptText((template as { text: string } | null)?.text ?? null);
    setAnswers((answerRows as Answer[] | null) ?? []);
    setLoading(false);
  }, [couple]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit() {
    if (!promptId || draft.trim().length === 0) return;
    setError(null);
    const { error: insertError } = await supabase
      .from('prompt_answers')
      .insert({ couple_daily_prompt_id: promptId, answer_text: draft.trim() });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDraft('');
    await load();
  }

  if (!couple) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <ScreenHeader />
        <View style={[styles.container, { paddingBottom: insets.bottom + BottomTabInset }]}>
          <NBCard>
            <ThemedText type="title">Couple prompts</ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
              Daily prompts and shared reveal unlock after you connect with your partner.
            </ThemedText>
            <View style={styles.cardButton}>
              <NBPrimaryButton title="Invite your partner" onPress={() => router.push('/pairing')} />
            </View>
          </NBCard>
        </View>
      </ThemedView>
    );
  }

  const myAnswer = answers.find((a) => a.user_id === session?.user.id);
  const partnerAnswer = answers.find((a) => a.user_id !== session?.user.id);
  const revealed = answers.length >= 2;

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScreenHeader centerLabel="Paired with Partner 💛" />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + BottomTabInset }]}>
        {loading ? (
          <ThemedText type="default" themeColor="textSecondary">
            Loading…
          </ThemedText>
        ) : !promptText ? (
          <NBCard style={styles.centered}>
            <Ionicons name="chatbubble-ellipses" size={40} color={theme.accent} style={styles.emptyIcon} />
            <ThemedText type="title" style={styles.centeredText}>
              Your daily prompts
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
              Your daily prompts will appear here. Pull to refresh.
            </ThemedText>
          </NBCard>
        ) : (
          <>
            <NBCard>
              <ThemedText type="default">{promptText}</ThemedText>
            </NBCard>

            {!myAnswer ? (
              <NBCard>
                <TextInput
                  placeholder="Message"
                  placeholderTextColor={theme.textSecondary}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  style={[styles.input, { color: theme.textPrimary }]}
                />
                <View style={styles.cardButton}>
                  <NBPrimaryButton title="Submit" onPress={onSubmit} />
                </View>
              </NBCard>
            ) : !revealed ? (
              <NBCard>
                <ThemedText type="default" themeColor="textSecondary">
                  You&apos;ve answered. Waiting for your partner to reveal both answers…
                </ThemedText>
              </NBCard>
            ) : (
              <>
                <NBCard>
                  <ThemedText type="smallBold">You</ThemedText>
                  <ThemedText type="default" style={styles.cardBody}>
                    {myAnswer.answer_text}
                  </ThemedText>
                </NBCard>
                <NBCard>
                  <ThemedText type="smallBold">Partner</ThemedText>
                  <ThemedText type="default" style={styles.cardBody}>
                    {partnerAnswer?.answer_text}
                  </ThemedText>
                </NBCard>
              </>
            )}
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

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  centered: { alignItems: 'center' },
  centeredText: { textAlign: 'center' },
  emptyIcon: { marginBottom: 8 },
  cardBody: { marginTop: 8 },
  cardButton: { marginTop: 12 },
  input: { minHeight: 80, textAlignVertical: 'top', fontSize: 16 },
});
