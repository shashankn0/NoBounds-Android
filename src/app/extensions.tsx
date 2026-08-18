import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

type ExtensionRow = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

const EXTENSIONS: ExtensionRow[] = [
  {
    id: 'date-ideas',
    icon: 'heart-outline',
    title: 'Date ideas',
    description:
      "A home card with reunion-aware date ideas — virtual while you're apart, in person as your reunion gets close.",
  },
  {
    id: 'gifts',
    icon: 'gift-outline',
    title: 'Gifts & acts of service',
    description: 'A home card with gift ideas and acts of service for him, her, or anyone — plus your own additions.',
  },
  {
    id: 'weekly-share',
    icon: 'chatbox-ellipses-outline',
    title: 'Weekly share',
    description: 'A home card for one shared message, quote, or link each week — a little ritual between you two.',
  },
  {
    id: 'habits',
    icon: 'checkmark-circle-outline',
    title: "Today's habits",
    description: "A home card with today's habits — check off what's left and jump to the full timeline.",
  },
  {
    id: 'pet',
    icon: 'paw-outline',
    title: 'Couple pet',
    description: 'A home card for your shared virtual pets — check in on your companions and jump into the play area.',
  },
  {
    id: 'cycle-tracking',
    icon: 'heart-circle-outline',
    title: 'Cycle tracking',
    description: 'A home card for couples cycle tracking — optionally share selected details with your partner for support.',
  },
];

const DEFAULT_ENABLED: Record<string, boolean> = {
  'date-ideas': false,
  gifts: false,
  'weekly-share': false,
  habits: true,
  pet: true,
  'cycle-tracking': true,
};

export default function ExtensionsScreen() {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [enabled, setEnabled] = useState(DEFAULT_ENABLED);
  const [feedback, setFeedback] = useState('');
  const [sent, setSent] = useState(false);

  function onSendFeedback() {
    if (feedback.trim().length === 0) return;
    setSent(true);
    setFeedback('');
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader
        title="Extensions"
        leftLabel={editing ? 'Done' : 'Edit'}
        onLeftPress={() => setEditing(!editing)}
        rightLabel="Done"
        onRightPress={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <NBCard style={styles.rowsCard}>
          {EXTENSIONS.map((ext) => (
            <View key={ext.id} style={styles.row}>
              <Ionicons name={ext.icon} size={20} color={theme.accent} style={styles.rowIcon} />
              <View style={styles.rowText}>
                <ThemedText type="smallBold">{ext.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.rowDescription}>
                  {ext.description}
                </ThemedText>
              </View>
              <Switch
                value={enabled[ext.id]}
                onValueChange={(value) => setEnabled((prev) => ({ ...prev, [ext.id]: value }))}
                trackColor={{ true: theme.accent, false: theme.border }}
              />
            </View>
          ))}
        </NBCard>
        <ThemedText type="small" themeColor="textSecondary">
          Tap Edit to reorder how these cards appear on Home.
        </ThemedText>

        <NBCard>
          <ThemedText type="smallBold">Have a suggestion?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.feedbackBody}>
            We&apos;d love to hear what would make No Bounds better for you two.
          </ThemedText>
          {sent ? (
            <ThemedText type="small" themeColor="accent" style={styles.feedbackBody}>
              Thanks — we got your message!
            </ThemedText>
          ) : (
            <>
              <TextInput
                value={feedback}
                onChangeText={setFeedback}
                multiline
                style={[styles.feedbackInput, { color: theme.textPrimary, borderColor: theme.border }]}
              />
              <View style={styles.sendButton}>
                <NBPrimaryButton title="Send" onPress={onSendFeedback} disabled={feedback.trim().length === 0} />
              </View>
            </>
          )}
        </NBCard>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  rowsCard: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, gap: 12 },
  rowIcon: { marginTop: 2 },
  rowText: { flex: 1, gap: 4 },
  rowDescription: { lineHeight: 18 },
  feedbackBody: { marginTop: 8, marginBottom: 8 },
  feedbackInput: { minHeight: 110, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, textAlignVertical: 'top' },
  sendButton: { marginTop: 12 },
});
