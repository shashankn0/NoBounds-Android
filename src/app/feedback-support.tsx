import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { submitFeedback } from '@/lib/feedback';

const HELP_CENTER_URL = 'https://no-bounds-landing-page.vercel.app/help';

const KINDS: { id: 'feedback' | 'bug_report'; label: string }[] = [
  { id: 'feedback', label: 'Feedback' },
  { id: 'bug_report', label: 'Bug report' },
];

export default function FeedbackSupportScreen() {
  const theme = useTheme();
  const [kind, setKind] = useState<'feedback' | 'bug_report'>('feedback');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (message.trim().length === 0) return;
    setSending(true);
    setError(null);
    try {
      await submitFeedback(kind, message.trim());
      setSent(true);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send');
    } finally {
      setSending(false);
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(HELP_CENTER_URL)}>
          <NBCard style={styles.helpRow}>
            <View style={[styles.helpIcon, { backgroundColor: theme.accentMuted }]}>
              <Ionicons name="help" size={16} color={theme.textOnAccent} />
            </View>
            <ThemedText type="default" style={styles.helpText}>
              Help center
            </ThemedText>
            <Ionicons name="arrow-up" size={18} color={theme.textSecondary} />
          </NBCard>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary">
          Or use the form below.
        </ThemedText>

        <NBCard>
          <View style={[styles.segmented, { backgroundColor: theme.backgroundSecondary }]}>
            {KINDS.map((k) => (
              <Pressable key={k.id} onPress={() => setKind(k.id)} style={styles.segmentWrap}>
                <View style={[styles.segment, kind === k.id && { backgroundColor: theme.surface }]}>
                  <ThemedText type="smallBold">{k.label}</ThemedText>
                </View>
              </Pressable>
            ))}
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {kind === 'feedback'
              ? 'Share ideas, praise, or anything that would make NoBounds better.'
              : "Tell us what went wrong — the more detail, the faster we can fix it."}
          </ThemedText>

          <ThemedText type="smallBold" style={styles.messageLabel}>
            Message
          </ThemedText>
          {sent ? (
            <ThemedText type="small" themeColor="accent" style={styles.messageLabel}>
              Thanks — we got your message!
            </ThemedText>
          ) : (
            <>
              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
              />
              <View style={styles.submitButton}>
                <NBPrimaryButton
                  title={sending ? 'Sending…' : 'Submit'}
                  onPress={onSubmit}
                  disabled={sending || message.trim().length === 0}
                />
              </View>
              {error ? (
                <ThemedText type="small" themeColor="destructive" style={styles.messageLabel}>
                  {error}
                </ThemedText>
              ) : null}
            </>
          )}
        </NBCard>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, gap: Spacing.two },
  helpRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  helpIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  helpText: { flex: 1 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: Spacing.three },
  segmentWrap: { flex: 1 },
  segment: { paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  hint: { marginBottom: Spacing.three },
  messageLabel: { marginTop: Spacing.two, marginBottom: Spacing.two },
  input: { minHeight: 110, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, textAlignVertical: 'top' },
  submitButton: { marginTop: Spacing.three },
});
