import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { NBPrimaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <TextInput
        placeholder="Email"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
      />
      <TextInput
        placeholder="Password"
        placeholderTextColor={theme.textSecondary}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
      />
      {error ? (
        <ThemedText type="small" themeColor="destructive">
          {error}
        </ThemedText>
      ) : null}
      <NBPrimaryButton title={loading ? 'Creating account…' : 'Sign up'} onPress={onSubmit} disabled={loading} />
      <Pressable onPress={() => router.push('/(auth)/sign-in')}>
        <ThemedText type="link" themeColor="accent" style={styles.link}>
          Already have an account? Sign in
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, gap: Spacing.three, justifyContent: 'center' },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 16 },
  link: { textAlign: 'center', marginTop: Spacing.two },
});
