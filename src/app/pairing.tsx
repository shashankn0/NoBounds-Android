import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton, NBSecondaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { functionErrorMessage, supabase } from '@/lib/supabase';

type Step = 'landing' | 'create' | 'accept';

const POLL_INTERVAL_MS = 8_000;

// port of features/pairing/pairingflowview.swift (+ createinviteview / acceptinviteview): a modal
// with a Close pill and three steps — landing, create invite, accept invite. like ios, "View
// pairing" from Settings opens this same landing step even when already paired.
export default function PairingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { couple, refreshCouple } = useSession();
  const [step, setStep] = useState<Step>('landing');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [enteredCode, setEnteredCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ios dismisses the sheet once pairing lands — but only if we weren't already paired on open
  const wasPairedOnOpen = useRef(!!couple);
  useEffect(() => {
    if (!wasPairedOnOpen.current && couple) router.back();
  }, [couple]);

  // while an invite is waiting, re-check for the partner every 8s (ios CreateInviteView polls too)
  useEffect(() => {
    if (!inviteCode) return;
    const id = setInterval(() => refreshCouple(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshCouple is a fresh closure each render
  }, [inviteCode]);

  function goTo(next: Step) {
    setError(null);
    setStep(next);
  }

  // one-time code, redeemed by the partner — a real edge function on the real backend
  // (create-couple-invite): no request body, returns {code, expires_at, share_url, ...}
  async function onCreateInvite() {
    setError(null);
    setLoading(true);
    const { data, error: fnError } = await supabase.functions.invoke('create-couple-invite');
    setLoading(false);
    if (fnError) {
      setError(await functionErrorMessage(fnError, 'Could not create an invite'));
      return;
    }
    setInviteCode((data as { code: string }).code);
  }

  // triggers the couple merge on the backend — solo data gets folded into the new couple.
  // also a real edge function (accept-couple-invite); body key is `code`, not `invite_code`
  async function onAcceptInvite() {
    setError(null);
    setLoading(true);
    const { error: fnError } = await supabase.functions.invoke('accept-couple-invite', {
      body: { code: enteredCode.trim() },
    });
    setLoading(false);
    if (fnError) {
      setError(await functionErrorMessage(fnError, 'Could not pair up'));
      return;
    }
    await refreshCouple();
    router.back();
  }

  return (
    <ThemedView style={styles.screen}>
      <FormHeader title="Pairing" leftLabel="Close" onLeftPress={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">
        {step === 'landing' ? (
          <View style={styles.section}>
            <ThemedText type="title">Connect with your partner</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Create an invite or enter a code. You can keep using the app in solo mode until your partner joins.
            </ThemedText>
            <NBPrimaryButton title="Create invite" onPress={() => goTo('create')} />
            <NBSecondaryButton title="Enter invite code" onPress={() => goTo('accept')} />
          </View>
        ) : null}

        {step === 'create' ? (
          <View style={styles.section}>
            <ThemedText type="title">Invite your partner</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Share this code with your partner. When they join, your solo activity merges into your shared space.
            </ThemedText>

            {inviteCode ? (
              <NBCard style={styles.codeCard}>
                <View style={styles.labeled}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.labelMedium}>
                    Code
                  </ThemedText>
                  <ThemedText type="smallBold" style={styles.codeValue}>
                    {inviteCode}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Waiting for your partner to accept…
                </ThemedText>
                <NBSecondaryButton title="Share code" onPress={() => Share.share({ message: inviteCode })} />
                <NBSecondaryButton title="Check for partner" onPress={() => refreshCouple()} />
              </NBCard>
            ) : (
              <NBPrimaryButton title={loading ? 'Creating invite…' : 'Create invite'} onPress={onCreateInvite} disabled={loading} />
            )}

            {error ? <ErrorText message={error} /> : null}
            <BackLink onPress={() => goTo('landing')} />
          </View>
        ) : null}

        {step === 'accept' ? (
          <View style={styles.section}>
            <ThemedText type="title">Join your partner</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Enter the invite code your partner shared with you.
            </ThemedText>

            <View style={styles.labeled}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.labelMedium}>
                Invite code
              </ThemedText>
              <TextInput
                placeholder="Code"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                value={enteredCode}
                onChangeText={setEnteredCode}
                style={[styles.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface }]}
              />
            </View>

            {loading ? (
              <ThemedText type="small" themeColor="textSecondary">
                Connecting…
              </ThemedText>
            ) : error ? (
              <ErrorText message={error} />
            ) : null}

            <NBPrimaryButton
              title={loading ? 'Connecting…' : 'Accept invite'}
              onPress={onAcceptInvite}
              disabled={loading || enteredCode.trim().length === 0}
            />
            <BackLink onPress={() => goTo('landing')} />
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function ErrorText({ message }: { message: string }) {
  return (
    <ThemedText type="small" themeColor="destructive" style={styles.footnote}>
      {message}
    </ThemedText>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.backLink}>
      <ThemedText type="default" themeColor="accent">
        Back
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 20 },
  // ios: each step is a VStack with 16 between its children
  section: { gap: 16 },
  codeCard: { gap: 12 },
  labeled: { gap: 4 },
  labelMedium: { fontWeight: '500' },
  codeValue: { fontWeight: '400' },
  input: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 16 },
  footnote: { fontSize: 13 },
  backLink: { alignSelf: 'flex-start' },
});
