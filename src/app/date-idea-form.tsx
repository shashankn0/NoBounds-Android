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
import { createDateIdea } from '@/lib/date-ideas';
import type { CostLevel, DateIdeaCategory, DateIdeaMode, DateIdeaSetting, TimeOfDay } from '@/lib/database-types';

const MODES: { id: DateIdeaMode; label: string }[] = [
  { id: 'virtual', label: 'Virtual' },
  { id: 'in_person', label: 'In person' },
];
// icons match ios's DateIdeaCategory.systemImageName (fork.knife / figure.hiking / sofa.fill /
// paintbrush.fill / gamecontroller.fill) — same catalog as the metadata chips on the browse screen
const CATEGORIES: { id: DateIdeaCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'food', label: 'Food', icon: 'restaurant' },
  { id: 'adventure', label: 'Adventure', icon: 'walk' },
  { id: 'cozy', label: 'Cozy', icon: 'home' },
  { id: 'creative', label: 'Creative', icon: 'color-palette' },
  { id: 'games', label: 'Games', icon: 'game-controller' },
];
const COSTS: { id: CostLevel; label: string }[] = [
  { id: 'free', label: 'Free' },
  { id: 'low', label: '$' },
  { id: 'medium', label: '$$' },
  { id: 'high', label: '$$$' },
];
const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];
const SETTINGS: { id: DateIdeaSetting; label: string }[] = [
  { id: 'indoor', label: 'Indoor' },
  { id: 'outdoor', label: 'Outdoor' },
  { id: 'either', label: 'Anywhere' },
];
const TIMES: { id: TimeOfDay; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'any', label: 'Anytime' },
];

// mirrors ios's durationLabel(_:) on CreateDateIdeaSheet
function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) return hours === 1 ? '1 hour' : `${hours} hours`;
  return `${hours}h ${remainder}m`;
}
const DURATION_OPTIONS = DURATIONS.map((minutes) => ({ id: String(minutes), label: durationLabel(minutes) }));

// port of features/dateideas/createdateideasheet.swift
export default function DateIdeaFormScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { couple } = useSession();
  const { initialMode } = useLocalSearchParams<{ initialMode?: DateIdeaMode }>();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [mode, setMode] = useState<DateIdeaMode>(initialMode === 'virtual' ? 'virtual' : 'in_person');
  const [category, setCategory] = useState<DateIdeaCategory>('cozy');
  const [costLevel, setCostLevel] = useState<CostLevel>('free');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [setting, setSetting] = useState<DateIdeaSetting>('either');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('any');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = title.trim().length > 0 && summary.trim().length > 0 && !saving;

  async function onSave() {
    if (!couple || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      await createDateIdea(couple.id, {
        title: title.trim(),
        summary: summary.trim(),
        category,
        mode,
        costLevel,
        durationMinutes,
        setting,
        timeOfDay,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your date idea');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader
        title="New date idea"
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
            placeholder="What's the plan?"
            placeholderTextColor={theme.textSecondary}
            value={summary}
            onChangeText={setSummary}
            multiline
            style={[styles.input, styles.multilineInput, { color: theme.textPrimary, borderColor: theme.border }]}
          />
        </NBCard>

        <NBCard style={styles.detailsCard}>
          <DropdownField label="Type" options={MODES} value={mode} onChange={setMode} />
          <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
          <DropdownField label="Category" options={CATEGORIES} value={category} onChange={setCategory} />
          <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
          <DropdownField label="Cost" options={COSTS} value={costLevel} onChange={setCostLevel} />
          <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
          <DropdownField
            label="Duration"
            options={DURATION_OPTIONS}
            value={String(durationMinutes)}
            onChange={(id) => setDurationMinutes(Number(id))}
          />
          <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
          <DropdownField label="Setting" options={SETTINGS} value={setting} onChange={setSetting} />
          <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
          <DropdownField label="Time of day" options={TIMES} value={timeOfDay} onChange={setTimeOfDay} />
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
