import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { functionErrorMessage, supabase } from '@/lib/supabase';

export default function PairingScreen() {
  const theme = useTheme();
  const { couple, refreshCouple } = useSession();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [enteredCode, setEnteredCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // one-time code, redeemed by the partner below — this is a real edge function on the real
  // backend (create-couple-invite), confirmed against its actual deployed source: no request
  // body, returns {contract_version, invite_id, code, expires_at, share_url, deep_link_url}
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

  if (couple) {
    return (
      <ThemedView style={styles.container}>
        <NBCard>
          <ThemedText type="title">You&apos;re paired 💛</ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
            You&apos;re already connected with your partner.
          </ThemedText>
          <View style={styles.cardButton}>
            <NBPrimaryButton title="Done" onPress={() => router.back()} />
          </View>
        </NBCard>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <NBCard>
        <ThemedText type="smallBold">Create an invite</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.cardBody}>
          Generate a code and send it to your partner.
        </ThemedText>
        {inviteCode ? (
          <ThemedText type="title" style={styles.code}>
            {inviteCode}
          </ThemedText>
        ) : (
          <View style={styles.cardButton}>
            <NBPrimaryButton title="Generate code" onPress={onCreateInvite} disabled={loading} />
          </View>
        )}
      </NBCard>

      <NBCard>
        <ThemedText type="smallBold">Have a code?</ThemedText>
        <TextInput
          placeholder="Enter code"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="characters"
          value={enteredCode}
          onChangeText={setEnteredCode}
          style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
        />
        <View style={styles.cardButton}>
          <NBPrimaryButton
            title={loading ? 'Pairing…' : 'Pair up'}
            onPress={onAcceptInvite}
            disabled={loading || enteredCode.length === 0}
          />
        </View>
      </NBCard>

      {error ? (
        <ThemedText type="small" themeColor="destructive">
          {error}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16 },
  cardBody: { marginTop: 8 },
  cardButton: { marginTop: 12 },
  code: { textAlign: 'center', letterSpacing: 4, marginTop: 12 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16 },
});
