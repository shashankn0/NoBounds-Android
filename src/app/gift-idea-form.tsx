import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DropdownField } from '@/components/dropdown-field';
import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { createGiftIdea } from '@/lib/gift-ideas';
import type { CostLevel, GiftKind, GiftRecipient } from '@/lib/database-types';

// icons match ios's GiftIdeaKind/GiftRecipient.systemImageName (gift.fill / hands.sparkles.fill,
// figure.stand / figure.stand.dress / person.fill) — same catalog as the browse screen's chips
const KINDS: { id: GiftKind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'gift', label: 'Gift', icon: 'gift' },
  { id: 'act_of_service', label: 'Act of service', icon: 'sparkles' },
];
const RECIPIENTS: { id: GiftRecipient; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'boy', label: 'Boy', icon: 'man' },
  { id: 'girl', label: 'Girl', icon: 'woman' },
  { id: 'other', label: 'Other', icon: 'person' },
];
const COSTS: { id: CostLevel; label: string }[] = [
  { id: 'free', label: 'Free' },
  { id: 'low', label: '$' },
  { id: 'medium', label: '$$' },
  { id: 'high', label: '$$$' },
];

// port of features/gifts/creategiftideasheet.swift — ios uses a plain (unstyled) Picker for
// Type/For/Cost inside a Form, which renders as a value + chevron row that opens a menu, not a
// segmented control
export default function GiftIdeaFormScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { couple } = useSession();
  const { initialKind } = useLocalSearchParams<{ initialKind?: GiftKind }>();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [kind, setKind] = useState<GiftKind>(initialKind === 'act_of_service' ? 'act_of_service' : 'gift');
  const [recipient, setRecipient] = useState<GiftRecipient>('other');
  const [costLevel, setCostLevel] = useState<CostLevel>('free');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = title.trim().length > 0 && summary.trim().length > 0 && !saving;

  async function onSave() {
    if (!couple || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      await createGiftIdea(couple.id, { title: title.trim(), summary: summary.trim(), kind, recipient, costLevel });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your idea');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader
        title="New idea"
        leftLabel="Cancel"
        onLeftPress={() => router.back()}
        rightLabel={saving ? 'Saving…' : 'Save'}
        onRightPress={onSave}
        rightDisabled={!canSave}
      />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        <NBCard>
          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
            Idea
          </ThemedText>
          <TextInput
            placeholder="Title"
            placeholderTextColor={theme.textSecondary}
            value={title}
            onChangeText={setTitle}
            style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
          />
          <TextInput
            placeholder="What's the idea?"
            placeholderTextColor={theme.textSecondary}
            value={summary}
            onChangeText={setSummary}
            multiline
            style={[styles.input, styles.multilineInput, { color: theme.textPrimary, borderColor: theme.border }]}
          />
        </NBCard>

        <NBCard style={styles.detailsCard}>
          <DropdownField label="Type" options={KINDS} value={kind} onChange={setKind} />
          <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
          <DropdownField label="For" options={RECIPIENTS} value={recipient} onChange={setRecipient} />
          <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
          <DropdownField label="Cost" options={COSTS} value={costLevel} onChange={setCostLevel} />
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
  sectionLabel: { marginBottom: 8 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginTop: 8 },
  multilineInput: { minHeight: 80, textAlignVertical: 'top' },
  detailsCard: { gap: 0, paddingVertical: 4 },
  rowDivider: { height: StyleSheet.hairlineWidth },
});
