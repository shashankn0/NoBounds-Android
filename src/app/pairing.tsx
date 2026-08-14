import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function PairingScreen() {
  const theme = useTheme();
  const { couple, refreshCouple } = useSession();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [enteredCode, setEnteredCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onCreateInvite() {
    setError(null);
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc('create_couple_invite').single();
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setInviteCode((data as { code: string }).code);
  }

  async function onAcceptInvite() {
    setError(null);
    setLoading(true);
    const { error: rpcError } = await supabase.rpc('accept_couple_invite', {
      invite_code: enteredCode.trim(),
    });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
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
