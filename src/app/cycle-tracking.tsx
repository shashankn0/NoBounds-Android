import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CyclePhaseBar } from '@/components/cycle-phase-bar';
import { CycleCalendar } from '@/components/cycle-calendar';
import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton, NBSecondaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { loadHideMyCycle, loadPartnerCycleFirst } from '@/lib/cycle-display-preferences';
import {
  CYCLE_FLOW_LABEL,
  CYCLE_MOOD_LABEL,
  CYCLE_PHASE_LABEL,
  CYCLE_SEVERITY_LABEL,
  CYCLE_SYMPTOM_LABEL,
  averageCycleLength,
  calculateCyclePhase,
  fetchCycleProfile,
  fetchDailyEntries,
  fetchPartnerDailyEntries,
  fetchPartnerPeriodLogs,
  fetchPartnerProfile,
  fetchPartnerSharingPermissions,
  fetchPeriodLogs,
  isProfileActivelySharing,
  logPeriodStart,
  type CyclePhaseSnapshot,
} from '@/lib/cycle-tracking';
import { CYCLE_MEDICAL_DISCLAIMER, cycleMoodExplanation, cycleSupportTips } from '@/lib/cycle-support-tips';
import type { CycleDailyEntry, CyclePeriodLog, CycleSharingPermissions, CycleTrackingProfile } from '@/lib/database-types';
import { dateKey, todayKey } from '@/lib/habits';

const DAILY_ENTRY_LOOKBACK_DAYS = 180;

type Segment = 'my' | 'partner';

export default function CycleTrackingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, couple } = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<CycleTrackingProfile | null>(null);
  const [periodLogs, setPeriodLogs] = useState<CyclePeriodLog[]>([]);
  const [dailyEntries, setDailyEntries] = useState<CycleDailyEntry[]>([]);

  const [partnerProfile, setPartnerProfile] = useState<CycleTrackingProfile | null>(null);
  const [partnerPermissions, setPartnerPermissions] = useState<CycleSharingPermissions | null>(null);
  const [partnerPeriodLogs, setPartnerPeriodLogs] = useState<CyclePeriodLog[]>([]);
  const [partnerDailyEntries, setPartnerDailyEntries] = useState<CycleDailyEntry[]>([]);

  const [hideMyCycle, setHideMyCycle] = useState(false);
  const [partnerCycleFirst, setPartnerCycleFirst] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment>('my');

  const partnerId = couple?.partnerId ?? null;

  const load = useCallback(async () => {
    if (!session || !couple) return;
    setLoading(true);
    setError(null);
    try {
      const [hideMy, partnerFirst, profileRow] = await Promise.all([
        loadHideMyCycle(),
        loadPartnerCycleFirst(),
        fetchCycleProfile(),
      ]);
      setHideMyCycle(hideMy);
      setPartnerCycleFirst(partnerFirst);
      setProfile(profileRow);

      const since = dateKey(new Date(Date.now() - DAILY_ENTRY_LOOKBACK_DAYS * 86_400_000));

      if (profileRow) {
        const [logs, entries] = await Promise.all([fetchPeriodLogs(), fetchDailyEntries(since)]);
        setPeriodLogs(logs);
        setDailyEntries(entries);
      }

      if (partnerId) {
        // each field is independent, best-effort, like ios's per-field `try?` — one failing
        // (network hiccup, a not-yet-shared permission) must never blank out the others
        const [pProfile, pPermissions, pLogs, pEntries] = await Promise.allSettled([
          fetchPartnerProfile(partnerId),
          fetchPartnerSharingPermissions(partnerId),
          fetchPartnerPeriodLogs(partnerId),
          fetchPartnerDailyEntries(partnerId, since),
        ]);
        if (pProfile.status === 'fulfilled') setPartnerProfile(pProfile.value);
        else console.warn('fetchPartnerProfile failed', pProfile.reason);
        if (pPermissions.status === 'fulfilled') setPartnerPermissions(pPermissions.value);
        else console.warn('fetchPartnerSharingPermissions failed', pPermissions.reason);
        if (pLogs.status === 'fulfilled') setPartnerPeriodLogs(pLogs.value);
        else console.warn('fetchPartnerPeriodLogs failed', pLogs.reason);
        if (pEntries.status === 'fulfilled') setPartnerDailyEntries(pEntries.value);
        else console.warn('fetchPartnerDailyEntries failed', pEntries.reason);
      }

      const availableNow: Segment[] = hideMy ? ['partner'] : partnerFirst ? ['partner', 'my'] : ['my', 'partner'];
      setSelectedSegment(availableNow[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load cycle tracking');
    } finally {
      setLoading(false);
    }
  }, [session, couple, partnerId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const availableSegments = useMemo<Segment[]>(
    () => (hideMyCycle ? ['partner'] : partnerCycleFirst ? ['partner', 'my'] : ['my', 'partner']),
    [hideMyCycle, partnerCycleFirst]
  );

  const myPhaseSnapshot = useMemo<CyclePhaseSnapshot | null>(() => {
    if (!profile) return null;
    const cycleLength = averageCycleLength(periodLogs) ?? profile.avg_cycle_length_days;
    return calculateCyclePhase(new Date(), periodLogs, cycleLength, profile.avg_period_length_days);
  }, [profile, periodLogs]);

  const partnerActivelySharing = isProfileActivelySharing(partnerProfile);

  const partnerPhaseSnapshot = useMemo<CyclePhaseSnapshot | null>(() => {
    if (!partnerProfile || !partnerActivelySharing) return null;
    const cycleLength = averageCycleLength(partnerPeriodLogs) ?? partnerProfile.avg_cycle_length_days;
    return calculateCyclePhase(new Date(), partnerPeriodLogs, cycleLength, partnerProfile.avg_period_length_days);
  }, [partnerProfile, partnerActivelySharing, partnerPeriodLogs]);

  async function onLogPeriodStart() {
    if (!couple) return;
    setSaving(true);
    try {
      await logPeriodStart(couple.id, todayKey());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log period start');
    } finally {
      setSaving(false);
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
      <ThemedView style={{ flex: 1 }}>
        <FormHeader title="Cycle tracking" leftLabel="Back" onLeftPress={() => router.back()} />
        <View style={styles.container}>
          <ThemedText type="default" themeColor="textSecondary">
            Loading…
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader
        title="Cycle tracking"
        leftLabel="Back"
        onLeftPress={() => router.back()}
        rightLabel="Settings"
        onRightPress={() => router.push('/cycle-sharing-settings')}
      />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        {availableSegments.length > 1 ? (
          <View style={[styles.segmented, { backgroundColor: theme.backgroundSecondary }]}>
            {availableSegments.map((segment) => (
              <Pressable key={segment} onPress={() => setSelectedSegment(segment)} style={styles.segmentWrap}>
                <View style={[styles.segment, selectedSegment === segment && { backgroundColor: theme.surface }]}>
                  <ThemedText type="smallBold">{segment === 'my' ? 'My Cycle' : "Partner's Cycle"}</ThemedText>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!profile ? (
          <NBCard>
            <ThemedText type="small" themeColor="textSecondary">
              Cycle sharing is disabled. Enable it from the home screen.
            </ThemedText>
          </NBCard>
        ) : selectedSegment === 'my' && !hideMyCycle ? (
          <MyCycleContent
            periodLogs={periodLogs}
            dailyEntries={dailyEntries}
            snapshot={myPhaseSnapshot}
            saving={saving}
            onLogPeriodStart={onLogPeriodStart}
          />
        ) : (
          <PartnerCycleContent
            partnerProfile={partnerProfile}
            partnerActivelySharing={partnerActivelySharing}
            permissions={partnerPermissions}
            snapshot={partnerPhaseSnapshot}
            periodLogs={partnerPeriodLogs}
            dailyEntries={partnerDailyEntries}
          />
        )}

        {error ? (
          <ThemedText type="small" themeColor="destructive">
            {error}
          </ThemedText>
        ) : null}

        <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
          {CYCLE_MEDICAL_DISCLAIMER}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function MyCycleContent({
  periodLogs,
  dailyEntries,
  snapshot,
  saving,
  onLogPeriodStart,
}: {
  periodLogs: CyclePeriodLog[];
  dailyEntries: CycleDailyEntry[];
  snapshot: CyclePhaseSnapshot | null;
  saving: boolean;
  onLogPeriodStart: () => void;
}) {
  if (!snapshot) return null;

  return (
    <>
      <NBCard>
        <CyclePhaseBar phase={snapshot.currentPhase} progress={snapshot.phaseProgress} />
      </NBCard>

      <NBCard>
        <CycleCalendar
          periodLogs={periodLogs}
          snapshot={snapshot}
          showFlowDetails
          onDayTap={(date) => router.push({ pathname: '/cycle-log', params: { date: dateKey(date) } })}
        />
      </NBCard>

      <NBCard style={styles.gapCard}>
        <ThemedText type="smallBold">Quick actions</ThemedText>
        <NBPrimaryButton title="Log today" onPress={() => router.push({ pathname: '/cycle-log', params: { date: todayKey() } })} />
        <NBSecondaryButton title={saving ? 'Logging…' : 'Log period start'} onPress={onLogPeriodStart} disabled={saving} />
      </NBCard>

      {dailyEntries.length > 0 ? (
        <NBCard style={styles.gapCard}>
          <ThemedText type="smallBold">Recent entries</ThemedText>
          {dailyEntries.slice(0, 5).map((entry) => (
            <EntryRow key={entry.id} entry={entry} showFlow showSymptoms />
          ))}
        </NBCard>
      ) : null}
    </>
  );
}

function PartnerCycleContent({
  partnerProfile,
  partnerActivelySharing,
  permissions,
  snapshot,
  periodLogs,
  dailyEntries,
}: {
  partnerProfile: CycleTrackingProfile | null;
  partnerActivelySharing: boolean;
  permissions: CycleSharingPermissions | null;
  snapshot: CyclePhaseSnapshot | null;
  periodLogs: CyclePeriodLog[];
  dailyEntries: CycleDailyEntry[];
}) {
  const theme = useTheme();

  if (!partnerProfile || !partnerActivelySharing) {
    return (
      <NBCard>
        <ThemedText type="small" themeColor="textSecondary">
          Your partner has not enabled cycle sharing yet.
        </ThemedText>
      </NBCard>
    );
  }

  if (!permissions?.share_phase || !snapshot) {
    return (
      <NBCard>
        <ThemedText type="small" themeColor="textSecondary">
          Your partner is sharing, but phase data is not visible yet.
        </ThemedText>
      </NBCard>
    );
  }

  const moodEntries = permissions.share_moods ? dailyEntries.filter((e) => e.mood) : [];
  const symptomEntries = permissions.share_symptoms ? dailyEntries.filter((e) => e.symptoms.length > 0) : [];

  return (
    <>
      <NBCard>
        <CyclePhaseBar phase={snapshot.currentPhase} progress={snapshot.phaseProgress} />
      </NBCard>

      <NBCard style={styles.gapCard}>
        <ThemedText type="smallBold">Support tips</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Ideas for today during the {CYCLE_PHASE_LABEL[snapshot.currentPhase].toLowerCase()} phase.
        </ThemedText>
        {cycleSupportTips(snapshot.currentPhase).map((tip) => (
          <View key={tip} style={styles.tipRow}>
            <Ionicons name="heart" size={13} color={theme.accent} style={styles.tipIcon} />
            <ThemedText type="default" style={styles.tipText}>
              {tip}
            </ThemedText>
          </View>
        ))}
      </NBCard>

      {permissions.share_period_dates && periodLogs.length > 0 ? (
        <NBCard>
          <CycleCalendar periodLogs={periodLogs} snapshot={snapshot} showFlowDetails={permissions.share_flow_details} />
        </NBCard>
      ) : null}

      {moodEntries.length > 0 ? (
        <NBCard style={styles.gapCard}>
          <ThemedText type="smallBold">Partner moods</ThemedText>
          {moodEntries.slice(0, 5).map((entry) => (entry.mood ? <MoodTooltip key={entry.id} mood={entry.mood} /> : null))}
        </NBCard>
      ) : null}

      {symptomEntries.length > 0 ? (
        <NBCard style={styles.gapCard}>
          <ThemedText type="smallBold">Recent symptoms</ThemedText>
          {symptomEntries.slice(0, 5).map((entry) => (
            <View key={entry.id} style={styles.symptomEntryRow}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.entryDate}>
                {formatEntryDate(entry.entry_date)}
              </ThemedText>
              {entry.symptoms.map((s) => (
                <ThemedText key={s.type} type="default">
                  {CYCLE_SYMPTOM_LABEL[s.type]} — {CYCLE_SEVERITY_LABEL[s.severity]}
                </ThemedText>
              ))}
            </View>
          ))}
        </NBCard>
      ) : null}
    </>
  );
}

function MoodTooltip({ mood }: { mood: CycleDailyEntry['mood'] }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  if (!mood) return null;

  return (
    <Pressable onPress={() => setExpanded((v) => !v)} style={[styles.moodTooltip, { backgroundColor: theme.backgroundSecondary }]}>
      <View style={styles.moodTooltipHeader}>
        <ThemedText type="smallBold">{CYCLE_MOOD_LABEL[mood]}</ThemedText>
        <Ionicons name={expanded ? 'chevron-up' : 'information-circle-outline'} size={16} color={theme.accent} />
      </View>
      {expanded ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.moodExplanation}>
          {cycleMoodExplanation(mood)}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

function EntryRow({ entry, showFlow, showSymptoms }: { entry: CycleDailyEntry; showFlow: boolean; showSymptoms: boolean }) {
  return (
    <View style={styles.entryRow}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.entryDate}>
        {formatEntryDate(entry.entry_date)}
      </ThemedText>
      {entry.mood ? <ThemedText type="default">Mood: {CYCLE_MOOD_LABEL[entry.mood]}</ThemedText> : null}
      {showFlow && entry.flow_level && entry.flow_level !== 'none' ? (
        <ThemedText type="default">Flow: {CYCLE_FLOW_LABEL[entry.flow_level]}</ThemedText>
      ) : null}
      {showSymptoms && entry.symptoms.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {entry.symptoms.map((s) => CYCLE_SYMPTOM_LABEL[s.type]).join(', ')}
        </ThemedText>
      ) : null}
    </View>
  );
}

function formatEntryDate(entryDate: string): string {
  return new Date(`${entryDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  segmentWrap: { flex: 1 },
  segment: { paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  gapCard: { gap: 10 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipIcon: { marginTop: 3 },
  tipText: { flex: 1 },
  entryRow: { paddingVertical: 6, gap: 2 },
  entryDate: { fontWeight: '600' },
  symptomEntryRow: { paddingVertical: 6, gap: 2 },
  moodTooltip: { borderRadius: 12, padding: 12, gap: 6 },
  moodTooltipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  moodExplanation: { lineHeight: 18 },
  disclaimer: { marginTop: 8, lineHeight: 18 },
});
