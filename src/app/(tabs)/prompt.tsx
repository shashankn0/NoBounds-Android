import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton, NBSecondaryButton } from '@/components/nb-button';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import type { PromptReaction } from '@/lib/database-types';
import { functionErrorMessage, supabase } from '@/lib/supabase';

// real column is `body`, not `answer_text` — matches public.prompt_answers on the real backend
type Answer = { id: string; user_id: string; body: string };

// enqueue_reaction_prompt_notification (real backend trigger) fires on insert here — this is
// the only piece missing to make that notification type ever actually send
const REACTION_EMOJI = ['❤️', '😂', '😮', '🥹'];

export default function PromptScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, couple } = useSession();
  const [promptText, setPromptText] = useState<string | null>(null);
  const [promptId, setPromptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [reactions, setReactions] = useState<PromptReaction[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // fetches (or creates) today's prompt via the real backend's ensure-daily-prompt edge
  // function (not a plain rpc) — it already resolves the display body server-side, so no
  // separate prompt_templates join is needed here
  const load = useCallback(async () => {
    if (!couple) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke('ensure-daily-prompt');

    if (fnError) {
      setError(await functionErrorMessage(fnError, 'Could not load today’s prompt'));
      setLoading(false);
      return;
    }

    const row = data as { couple_daily_prompt_id: string; body: string };
    setPromptId(row.couple_daily_prompt_id);
    setPromptText(row.body);

    // rls only returns the partner's row once prompt_both_answered() is true, so `answers`
    // naturally has 1 row pre-reveal and 2 once both have submitted — no manual gating needed
    const { data: answerRows } = await supabase
      .from('prompt_answers')
      .select('id, user_id, body')
      .eq('couple_daily_prompt_id', row.couple_daily_prompt_id);

    const rows = (answerRows as Answer[] | null) ?? [];
    setAnswers(rows);

    if (rows.length > 0) {
      const { data: reactionRows } = await supabase
        .from('prompt_reactions')
        .select('id, prompt_answer_id, user_id, emoji, created_at')
        .in(
          'prompt_answer_id',
          rows.map((a) => a.id)
        );
      setReactions((reactionRows as PromptReaction[] | null) ?? []);
    } else {
      setReactions([]);
    }
    setLoading(false);
  }, [couple]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit() {
    if (!promptId || draft.trim().length === 0 || !session) return;
    setError(null);
    // user_id has no default on the real table — rls requires it to match auth.uid() anyway
    const { error: insertError } = await supabase
      .from('prompt_answers')
      .insert({ couple_daily_prompt_id: promptId, user_id: session.user.id, body: draft.trim() });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDraft('');
    await load();
  }

  // one reaction per answer per person — matches the real table's unique(prompt_answer_id, user_id)
  async function onReact(answerId: string, emoji: string) {
    if (!session) return;
    const { error: reactError } = await supabase
      .from('prompt_reactions')
      .upsert({ prompt_answer_id: answerId, user_id: session.user.id, emoji }, { onConflict: 'prompt_answer_id,user_id' });
    if (reactError) {
      setError(reactError.message);
      return;
    }
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
  // only reveal once both partners have answered
  const revealed = answers.length >= 2;
  // one answer per person, so the composer stays visible (like ios) but goes inert after answering
  const canSubmit = !!promptId && !myAnswer && draft.trim().length > 0;

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScreenHeader showPairing />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + BottomTabInset }]}>
        {/* ios shows the failure as a card with its own retry action, above whatever else renders */}
        {error ? (
          <NBCard>
            <ThemedText type="default" themeColor="textSecondary">
              {error}
            </ThemedText>
            <View style={styles.cardButton}>
              <NBSecondaryButton title="Try again" onPress={load} />
            </View>
          </NBCard>
        ) : null}

        {loading ? (
          <ThemedText type="default" themeColor="textSecondary">
            Loading…
          </ThemedText>
        ) : !promptText ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbox-ellipses" size={64} color={theme.accent} style={styles.emptyIcon} />
            <ThemedText type="title" style={styles.centeredText}>
              Your daily prompts
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
              Your daily prompts will appear here. Pull to refresh.
            </ThemedText>
          </View>
        ) : (
          <>
            <NBCard>
              <ThemedText type="default">{promptText}</ThemedText>
            </NBCard>

            {!myAnswer ? null : !revealed ? (
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
                    {myAnswer.body}
                  </ThemedText>
                </NBCard>
                <NBCard>
                  <ThemedText type="smallBold">Partner</ThemedText>
                  <ThemedText type="default" style={styles.cardBody}>
                    {partnerAnswer?.body}
                  </ThemedText>
                  {partnerAnswer ? (
                    <View style={styles.reactionRow}>
                      {REACTION_EMOJI.map((emoji) => {
                        const mine = reactions.some(
                          (r) => r.prompt_answer_id === partnerAnswer.id && r.user_id === session?.user.id && r.emoji === emoji
                        );
                        return (
                          <Pressable
                            key={emoji}
                            onPress={() => onReact(partnerAnswer.id, emoji)}
                            style={[styles.reactionChip, { borderColor: mine ? theme.accent : theme.border }, mine && { backgroundColor: theme.accentMuted }]}>
                            <ThemedText type="default">{emoji}</ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </NBCard>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* pinned compose bar — ios keeps this visible in every state, including the error one */}
      <View style={[styles.composerBar, { paddingBottom: insets.bottom + BottomTabInset }]}>
        <View style={[styles.composerField, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            placeholder="Message"
            placeholderTextColor={theme.textSecondary}
            value={draft}
            onChangeText={setDraft}
            style={[styles.composerInput, { color: theme.textPrimary }]}
          />
        </View>
        <Pressable onPress={onSubmit} disabled={!canSubmit} hitSlop={8}>
          <Ionicons name="arrow-up-circle" size={40} color={canSubmit ? theme.accent : theme.textSecondary} />
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  centeredText: { textAlign: 'center' },
  // ios centers this in the empty space rather than boxing it in a card
  emptyState: { alignItems: 'center', gap: 6, paddingTop: 100 },
  emptyIcon: { marginBottom: 8 },
  cardBody: { marginTop: 8 },
  cardButton: { marginTop: 12 },
  composerBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 8 },
  composerField: { flex: 1, borderRadius: 999, borderWidth: 1, paddingHorizontal: 18 },
  composerInput: { paddingVertical: 12, fontSize: 16 },
  reactionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  reactionChip: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
