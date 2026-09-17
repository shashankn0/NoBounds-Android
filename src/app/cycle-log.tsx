import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { dateKey } from '@/lib/habits';
import {
  CYCLE_FLOW_LABEL,
  CYCLE_MOOD_LABEL,
  CYCLE_SEVERITY_LABEL,
  CYCLE_SYMPTOM_LABEL,
  fetchDailyEntry,
  logDailyEntry,
} from '@/lib/cycle-tracking';
import type { CycleFlowLevel, CycleMood, CycleSymptom, CycleSymptomSeverity, CycleSymptomType } from '@/lib/database-types';

const MOODS: CycleMood[] = ['happy', 'calm', 'anxious', 'irritable', 'sad', 'energetic', 'tired'];
const MOOD_LABEL = CYCLE_MOOD_LABEL;
const FLOW_LEVELS: CycleFlowLevel[] = ['none', 'light', 'medium', 'heavy'];
const FLOW_LABEL = CYCLE_FLOW_LABEL;
const SEVERITIES: CycleSymptomSeverity[] = ['mild', 'moderate', 'severe'];
const SEVERITY_LABEL = CYCLE_SEVERITY_LABEL;
const SYMPTOM_TYPES: CycleSymptomType[] = [
  'cramps',
  'headache',
  'migraine',
  'bloating',
  'nausea',
  'back_pain',
  'breast_tenderness',
  'fatigue',
];
const SYMPTOM_LABEL = CYCLE_SYMPTOM_LABEL;

// port of features/cycletracking/components/cyclelogsheet.swift — mood/flow/symptoms for one day
export default function CycleLogScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { couple } = useSession();
  const { date: dateParam } = useLocalSearchParams<{ date: string }>();

  const entryDate = dateParam ?? dateKey(new Date());
  const isToday = entryDate === dateKey(new Date());

  const displayDate = useMemo(
    () => new Date(`${entryDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    [entryDate]
  );

  const [loading, setLoading] = useState(true);
  const [mood, setMood] = useState<CycleMood | null>(null);
  const [flow, setFlow] = useState<CycleFlowLevel | null>(null);
  const [symptoms, setSymptoms] = useState<Partial<Record<CycleSymptomType, CycleSymptomSeverity>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDailyEntry(entryDate)
      .then((existing) => {
        if (cancelled || !existing) return;
        setMood(existing.mood);
        setFlow(existing.flow_level);
        const bySymptom: Partial<Record<CycleSymptomType, CycleSymptomSeverity>> = {};
        for (const s of existing.symptoms) bySymptom[s.type] = s.severity;
        setSymptoms(bySymptom);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entryDate]);

  function onSetSymptom(type: CycleSymptomType, severity: CycleSymptomSeverity | null) {
    setSymptoms((prev) => {
      const next = { ...prev };
      if (severity) next[type] = severity;
      else delete next[type];
      return next;
    });
  }

  async function onSave() {
    if (!couple) return;
    setSaving(true);
    setError(null);
    try {
      const symptomList: CycleSymptom[] = SYMPTOM_TYPES.filter((type) => symptoms[type]).map((type) => ({
        type,
        severity: symptoms[type]!,
      }));
      await logDailyEntry(couple.id, entryDate, { mood, flowLevel: flow, symptoms: symptomList });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      setSaving(false);
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader
        title={isToday ? 'Log today' : 'Log day'}
        leftLabel="Cancel"
        onLeftPress={() => router.back()}
        rightLabel={saving ? 'Saving…' : 'Save'}
        onRightPress={onSave}
        rightDisabled={saving || loading}
      />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        <NBCard>
          <ThemedText type="small" themeColor="textSecondary">
            Date
          </ThemedText>
          <View style={[styles.datePill, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="default">{displayDate}</ThemedText>
          </View>
        </NBCard>

        <NBCard>
          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
            Mood
          </ThemedText>
          <View style={styles.chipRow}>
            <Chip label="None" active={mood === null} onPress={() => setMood(null)} theme={theme} />
            {MOODS.map((m) => (
              <Chip key={m} label={MOOD_LABEL[m]} active={mood === m} onPress={() => setMood(m)} theme={theme} />
            ))}
          </View>
        </NBCard>

        <NBCard>
          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
            Flow
          </ThemedText>
          <View style={styles.chipRow}>
            {FLOW_LEVELS.map((level) => (
              <Chip key={level} label={FLOW_LABEL[level]} active={(flow ?? 'none') === level} onPress={() => setFlow(level)} theme={theme} />
            ))}
          </View>
        </NBCard>

        <NBCard style={styles.symptomsCard}>
          <ThemedText type="small" themeColor="textSecondary">
            Symptoms
          </ThemedText>
          {SYMPTOM_TYPES.map((type) => (
            <View key={type} style={styles.symptomRow}>
              <ThemedText type="default" style={styles.symptomLabel}>
                {SYMPTOM_LABEL[type]}
              </ThemedText>
              <View style={styles.chipRow}>
                <Chip label="None" active={!symptoms[type]} onPress={() => onSetSymptom(type, null)} theme={theme} small />
                {SEVERITIES.map((severity) => (
                  <Chip
                    key={severity}
                    label={SEVERITY_LABEL[severity]}
                    active={symptoms[type] === severity}
                    onPress={() => onSetSymptom(type, severity)}
                    theme={theme}
                    small
                  />
                ))}
              </View>
            </View>
          ))}
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

function Chip({
  label,
  active,
  onPress,
  theme,
  small,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        small && styles.chipSmall,
        { borderColor: active ? theme.accent : theme.border },
        active && { backgroundColor: theme.accentMuted },
      ]}>
      <ThemedText type="small">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  sectionLabel: { marginBottom: 8 },
  datePill: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start', marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderRadius: 999 },
  chipSmall: { paddingVertical: 6, paddingHorizontal: 10 },
  symptomsCard: { gap: 4 },
  symptomRow: { marginTop: 12 },
  symptomLabel: { fontWeight: '600' },
});
