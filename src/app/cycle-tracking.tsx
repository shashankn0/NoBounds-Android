import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { fetchCycleProfile, fetchSharingPermissions, logDailyEntry, upsertSharingPermissions } from '@/lib/cycle-tracking';
import type {
  CycleDailyEntry,
  CycleFlowLevel,
  CycleMood,
  CycleSharingPermissions,
  CycleSymptom,
  CycleSymptomSeverity,
  CycleSymptomType,
  CycleTrackingProfile,
} from '@/lib/database-types';
import { supabase } from '@/lib/supabase';

const FLOW_LEVELS: CycleFlowLevel[] = ['none', 'light', 'medium', 'heavy'];
// tapping a symptom cycles through these, then back off — lets severe actually be reachable,
// which matters since the real backend's SOS notification only fires on 'severe'
const SEVERITY_CYCLE: CycleSymptomSeverity[] = ['mild', 'moderate', 'severe'];
const MOODS: CycleMood[] = ['happy', 'calm', 'anxious', 'irritable', 'sad', 'energetic', 'tired'];
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
const SHARING_LABELS: { key: keyof Omit<CycleSharingPermissions, 'user_id' | 'updated_at'>; label: string }[] = [
  { key: 'share_period_dates', label: 'Period dates' },
  { key: 'share_flow_details', label: 'Flow details' },
  { key: 'share_moods', label: 'Moods' },
  { key: 'share_symptoms', label: 'Symptoms' },
  { key: 'share_phase', label: 'Cycle phase' },
];

export default function CycleTrackingScreen() {
  const theme = useTheme();
  const { session, couple } = useSession();
  const [profile, setProfile] = useState<CycleTrackingProfile | null>(null);
  const [sharing, setSharing] = useState<CycleSharingPermissions | null>(null);
  const [todayEntry, setTodayEntry] = useState<CycleDailyEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profileRow = await fetchCycleProfile();
      setProfile(profileRow);
      if (profileRow) {
        const [sharingRow, { data: entryRow }] = await Promise.all([
          fetchSharingPermissions(),
          supabase
            .from('cycle_daily_entries')
            .select('*')
            .eq('user_id', profileRow.user_id)
            .eq('entry_date', today)
            .maybeSingle(),
        ]);
        setSharing(sharingRow);
        setTodayEntry((entryRow as CycleDailyEntry | null) ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load cycle tracking');
    } finally {
      setLoading(false);
    }
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onOptIn() {
    if (!session || !couple) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase
      .from('cycle_tracking_profiles')
      .insert({ user_id: session.user.id, couple_id: couple.id });
    if (insertError) {
      setSaving(false);
      setError(insertError.message);
      return;
    }
    // sharing permissions is a separate row, defaults everything to off until turned on below
    await supabase.from('cycle_sharing_permissions').insert({ user_id: session.user.id });
    setSaving(false);
    await load();
  }

  async function onSetMood(mood: CycleMood) {
    if (!couple) return;
    const next = todayEntry?.mood === mood ? null : mood;
    setTodayEntry((prev) => (prev ? { ...prev, mood: next } : prev));
    try {
      await logDailyEntry(couple.id, today, { mood: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save mood');
    }
  }

  async function onSetFlow(level: CycleFlowLevel) {
    if (!couple) return;
    setTodayEntry((prev) => (prev ? { ...prev, flow_level: level } : prev));
    try {
      await logDailyEntry(couple.id, today, { flowLevel: level });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save flow');
    }
  }

  // tap cycles off -> mild -> moderate -> severe -> off
  async function onToggleSymptom(type: CycleSymptomType) {
    if (!couple) return;
    const current: CycleSymptom[] = todayEntry?.symptoms ?? [];
    const existing = current.find((s) => s.type === type);
    const cycleIndex = existing ? SEVERITY_CYCLE.indexOf(existing.severity) : -1;
    const nextSeverity = cycleIndex >= 0 ? SEVERITY_CYCLE[cycleIndex + 1] : SEVERITY_CYCLE[0];

    const next = nextSeverity
      ? [...current.filter((s) => s.type !== type), { type, severity: nextSeverity }]
      : current.filter((s) => s.type !== type);

    setTodayEntry((prev) => (prev ? { ...prev, symptoms: next } : prev));
    try {
      await logDailyEntry(couple.id, today, { symptoms: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save symptoms');
    }
  }

  async function onToggleSharing(key: (typeof SHARING_LABELS)[number]['key'], value: boolean) {
    setSharing((prev) => (prev ? { ...prev, [key]: value } : prev));
    try {
      await upsertSharingPermissions({ [key]: value });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update sharing');
    }
  }

  if (!couple) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="default" themeColor="textSecondary">
          Cycle tracking unlocks once you connect with your partner.
        </ThemedText>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="default" themeColor="textSecondary">
          Loading…
        </ThemedText>
      </ThemedView>
    );
  }

  if (!profile) {
    return (
      <ThemedView style={styles.container}>
        <NBCard>
          <ThemedText type="title">Cycle tracking</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            Track your cycle, and optionally share details with your partner.
          </ThemedText>
          <View style={styles.body}>
            <NBPrimaryButton title={saving ? 'Turning on…' : 'Turn on'} onPress={onOptIn} disabled={saving} />
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

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <NBCard>
          <ThemedText type="title">Cycle tracking</ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.body}>
            {profile.avg_cycle_length_days}-day average cycle
          </ThemedText>
        </NBCard>

        <NBCard>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            Today&apos;s mood
          </ThemedText>
          <View style={styles.chipRow}>
            {MOODS.map((mood) => {
              const active = todayEntry?.mood === mood;
              return (
                <Pressable
                  key={mood}
                  onPress={() => onSetMood(mood)}
                  style={[
                    styles.chip,
                    { borderColor: active ? theme.accent : theme.border },
                    active && { backgroundColor: theme.accentMuted },
                  ]}>
                  <ThemedText type="small">{mood}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </NBCard>

        <NBCard>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            Today&apos;s flow
          </ThemedText>
          <View style={styles.chipRow}>
            {FLOW_LEVELS.map((level) => {
              const active = todayEntry?.flow_level === level;
              return (
                <Pressable
                  key={level}
                  onPress={() => onSetFlow(level)}
                  style={[
                    styles.chip,
                    { borderColor: active ? theme.accent : theme.border },
                    active && { backgroundColor: theme.accentMuted },
                  ]}>
                  <ThemedText type="small">{level}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </NBCard>

        <NBCard>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            Symptoms — tap to cycle mild → moderate → severe
          </ThemedText>
          <View style={styles.chipRow}>
            {SYMPTOM_TYPES.map((type) => {
              const entry = (todayEntry?.symptoms ?? []).find((s) => s.type === type);
              return (
                <Pressable
                  key={type}
                  onPress={() => onToggleSymptom(type)}
                  style={[
                    styles.chip,
                    { borderColor: entry ? theme.accent : theme.border },
                    entry && { backgroundColor: theme.accentMuted },
                  ]}>
                  <ThemedText type="small">
                    {type.replace('_', ' ')}
                    {entry ? ` · ${entry.severity}` : ''}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </NBCard>

        <NBCard>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            Share with partner
          </ThemedText>
          {SHARING_LABELS.map(({ key, label }) => (
            <View key={key} style={styles.sharingRow}>
              <ThemedText type="default" style={styles.sharingLabel}>
                {label}
              </ThemedText>
              <Switch
                value={sharing?.[key] ?? false}
                onValueChange={(value) => onToggleSharing(key, value)}
                trackColor={{ true: theme.accent, false: theme.border }}
              />
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

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  body: { marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderRadius: 999 },
  sharingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  sharingLabel: { flex: 1 },
});
