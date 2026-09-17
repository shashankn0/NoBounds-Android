import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CyclePhaseBar } from '@/components/cycle-phase-bar';
import { HabitRow } from '@/components/habit-row';
import { HomeDateIdeasCard } from '@/components/home-date-ideas-card';
import { HomeGiftIdeasCard } from '@/components/home-gift-ideas-card';
import { HomeWeeklyShareCard } from '@/components/home-weekly-share-card';
import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton, NBSecondaryButton } from '@/components/nb-button';
import { PetPreviewRow } from '@/components/pet-preview-row';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { calculateCyclePhase, fetchCycleProfile, fetchPeriodLogs, type CyclePhaseSnapshot } from '@/lib/cycle-tracking';
import type { CycleTrackingProfile, PresencePhoto, UserPet } from '@/lib/database-types';
import {
  DEFAULT_EXTENSION_ENABLED,
  EXTENSION_IDS,
  loadExtensionEnabled,
  loadExtensionOrder,
  type ExtensionId,
} from '@/lib/extension-preferences';
import {
  currentStreak,
  dateKey,
  fetchCompletionsInRange,
  fetchHabits,
  toggleHabitToday,
  todaysDayStatuses,
  type Habit,
  type HabitCompletion,
  type HabitDayStatus,
} from '@/lib/habits';
import { fetchPets } from '@/lib/pets';
import { getSignedUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

// how far back to fetch completions for streak math — plenty for the "🔥 N" badges without
// pulling a couple's entire habit history on every home-tab focus
const STREAK_LOOKBACK_DAYS = 60;

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, couple } = useSession();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [myPet, setMyPet] = useState<UserPet | null>(null);
  const [partnerPet, setPartnerPet] = useState<UserPet | null>(null);
  const [lastBound, setLastBound] = useState<PresencePhoto | null>(null);
  const [lastBoundUrl, setLastBoundUrl] = useState<string | null>(null);
  const [cycleProfile, setCycleProfile] = useState<CycleTrackingProfile | null>(null);
  const [cyclePhase, setCyclePhase] = useState<CyclePhaseSnapshot | null>(null);
  const [cycleOptingIn, setCycleOptingIn] = useState(false);
  const [extensionEnabled, setExtensionEnabled] = useState(DEFAULT_EXTENSION_ENABLED);
  const [extensionOrder, setExtensionOrder] = useState<ExtensionId[]>(EXTENSION_IDS);

  // works solo pre-pairing and shows shared habits once merged
  const loadHabits = useCallback(async () => {
    try {
      const habitRows = await fetchHabits();
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - STREAK_LOOKBACK_DAYS);
      const completionRows = await fetchCompletionsInRange(
        habitRows.map((h) => h.id),
        dateKey(from),
        dateKey(to)
      );
      setHabits(habitRows);
      setCompletions(completionRows);
    } catch {
      // home's habit card is a summary — timeline shows the real error state
    }
  }, []);

  const currentUserId = session?.user.id ?? null;
  const partnerId = couple?.partnerId ?? null;

  // resolves each habit against BOTH partners' completions — mine/yours/ours + either/both, plus
  // the bound_streak/weeks_bound system habits' own status copy — mirrors ios's HabitsRepository
  const habitStatuses = useMemo<HabitDayStatus[]>(() => {
    if (!currentUserId) return [];
    return todaysDayStatuses(habits, completions, currentUserId, partnerId);
  }, [habits, completions, currentUserId, partnerId]);

  // these cards are all couple-scoped — nothing to load solo
  const loadExtras = useCallback(async () => {
    if (!couple || !session) return;
    try {
      const [pets, { data: photoRows }, cycleProfileRow] = await Promise.all([
        fetchPets(couple.id),
        supabase
          .from('presence_photos')
          .select('*')
          .eq('couple_id', couple.id)
          .neq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1),
        fetchCycleProfile(),
      ]);
      setMyPet(pets.find((p) => p.user_id === session.user.id) ?? null);
      setPartnerPet(pets.find((p) => p.user_id !== session.user.id) ?? null);

      const latest = ((photoRows as PresencePhoto[] | null) ?? [])[0] ?? null;
      setLastBound(latest);
      setLastBoundUrl(latest ? await getSignedUrl('presence', latest.storage_path) : null);

      setCycleProfile(cycleProfileRow);
      if (cycleProfileRow) {
        const periodLogs = await fetchPeriodLogs();
        setCyclePhase(
          calculateCyclePhase(new Date(), periodLogs, cycleProfileRow.avg_cycle_length_days, cycleProfileRow.avg_period_length_days)
        );
      }
    } catch {
      // these are summary cards — each dedicated screen shows the real error state
    }
  }, [couple, session]);

  // refetch every time the tab regains focus, not just on mount — extension preferences too,
  // since they can change on the extensions sheet without this screen remounting
  useFocusEffect(
    useCallback(() => {
      loadHabits();
      loadExtras();
      loadExtensionEnabled().then(setExtensionEnabled);
      loadExtensionOrder().then(setExtensionOrder);
    }, [loadHabits, loadExtras])
  );

  async function onToggle(status: HabitDayStatus) {
    await toggleHabitToday(status.habit.id, !status.myCompleted);
    await loadHabits();
  }

  // mirrors cycletrackinghomesection.swift's opt-in card — sharing permissions default all-off
  async function onEnableCycleSharing() {
    if (!session || !couple) return;
    setCycleOptingIn(true);
    try {
      await supabase.from('cycle_tracking_profiles').insert({ user_id: session.user.id, couple_id: couple.id });
      await supabase.from('cycle_sharing_permissions').insert({ user_id: session.user.id });
      await loadExtras();
    } finally {
      setCycleOptingIn(false);
    }
  }

  // mirrors ios's HomePlaceholderView.extensionCard(for:): one card per enabled extension, in
  // the order the extensions sheet persisted — couple-only, so solo users never see this loop
  function renderExtensionCard(id: ExtensionId) {
    switch (id) {
      case 'habits':
        if (habits.length === 0) return null;
        return (
          <NBCard>
            <View style={styles.rowBetween}>
              <ThemedText type="title">Today&apos;s habits</ThemedText>
              <Pressable onPress={() => router.push('/timeline')}>
                <ThemedText type="link" themeColor="accent">
                  See all
                </ThemedText>
              </Pressable>
            </View>
            {habitStatuses.slice(0, 3).map((status) => (
              <HabitRow
                key={status.habit.id}
                status={status}
                streak={currentUserId ? currentStreak(status.habit, completions, currentUserId, partnerId) : 0}
                onToggle={onToggle}
              />
            ))}
            {habitStatuses.length > 3 ? (
              <ThemedText type="small" themeColor="textSecondary">
                +{habitStatuses.length - 3} more in Timeline
              </ThemedText>
            ) : null}
          </NBCard>
        );
      case 'pet':
        return (
          <NBCard>
            <View style={styles.rowBetween}>
              <ThemedText type="title">Your pets</ThemedText>
              <Ionicons name="paw" size={18} color={theme.accent} />
            </View>
            <View style={styles.petRowSpacing}>
              <PetPreviewRow myPet={myPet} partnerPet={partnerPet} />
            </View>
            <View style={styles.cardButton}>
              {myPet ? (
                <NBSecondaryButton title="Visit play area" onPress={() => router.push('/play')} />
              ) : (
                <NBPrimaryButton title="Choose your pet" onPress={() => router.push('/pet')} />
              )}
            </View>
          </NBCard>
        );
      case 'cycle-tracking':
        return (
          <NBCard>
            <View style={styles.rowBetween}>
              <ThemedText type="title">Cycle tracking</ThemedText>
              <Ionicons name="heart-circle" size={18} color={theme.accent} />
            </View>
            {cycleProfile && cyclePhase ? (
              <View style={styles.cardBody}>
                <CyclePhaseBar phase={cyclePhase.currentPhase} progress={cyclePhase.phaseProgress} />
              </View>
            ) : (
              <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
                Optionally track your cycle and share selected details with your partner for support.
              </ThemedText>
            )}
            <View style={styles.cardButton}>
              {cycleProfile ? (
                <NBSecondaryButton title="Open dashboard" onPress={() => router.push('/cycle-tracking')} />
              ) : (
                <NBPrimaryButton
                  title={cycleOptingIn ? 'Enabling…' : 'Enable cycle sharing'}
                  onPress={onEnableCycleSharing}
                  disabled={cycleOptingIn}
                />
              )}
            </View>
          </NBCard>
        );
      case 'date-ideas':
        return couple ? <HomeDateIdeasCard coupleId={couple.id} /> : null;
      case 'gifts':
        return couple ? <HomeGiftIdeasCard coupleId={couple.id} /> : null;
      case 'weekly-share':
        return couple && session ? <HomeWeeklyShareCard coupleId={couple.id} currentUserId={session.user.id} /> : null;
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScreenHeader showPairing />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + BottomTabInset }]}>
        {!couple ? (
          <NBCard>
            <ThemedText type="title">Invite your partner</ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
              Create a code to connect. You can keep using No Bounds while you wait.
            </ThemedText>
            <View style={styles.cardButton}>
              <NBPrimaryButton title="Set up pairing" onPress={() => router.push('/pairing')} />
            </View>
          </NBCard>
        ) : (
          <NBCard>
            <ThemedText type="title">{couple.partnerName?.trim() || 'Partner'}&apos;s Last Bound</ThemedText>
            {lastBound && lastBoundUrl ? (
              <>
                <Pressable onPress={() => router.push({ pathname: '/photo-detail', params: { photoId: lastBound.id } })}>
                  <Image source={{ uri: lastBoundUrl }} style={styles.lastBoundImage} />
                </Pressable>
                {lastBound.mood_tag ? (
                  <ThemedText type="small" themeColor="accent" style={[styles.lastBoundMood, styles.lastBoundMoodText]}>
                    {lastBound.mood_tag}
                  </ThemedText>
                ) : null}
              </>
            ) : (
              <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
                Waiting for a photo from your partner.
              </ThemedText>
            )}
          </NBCard>
        )}

        {!couple ? (
          habits.length > 0 ? (
            <NBCard>
              <View style={styles.rowBetween}>
                <ThemedText type="title">Today&apos;s habits</ThemedText>
                <Pressable onPress={() => router.push('/timeline')}>
                  <ThemedText type="link" themeColor="accent">
                    See all
                  </ThemedText>
                </Pressable>
              </View>
              {habitStatuses.slice(0, 3).map((status) => (
                <HabitRow
                  key={status.habit.id}
                  status={status}
                  streak={currentUserId ? currentStreak(status.habit, completions, currentUserId, partnerId) : 0}
                  onToggle={onToggle}
                />
              ))}
              {habitStatuses.length > 3 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  +{habitStatuses.length - 3} more in Timeline
                </ThemedText>
              ) : null}
            </NBCard>
          ) : (
            <NBCard>
              <ThemedText type="title">Today&apos;s habits</ThemedText>
              <ThemedText type="default" themeColor="textSecondary" style={styles.habitEmpty}>
                Start with personal habits—they&apos;ll merge when you connect.
              </ThemedText>
              <View style={styles.cardButton}>
                <NBSecondaryButton title="Open timeline" onPress={() => router.push('/timeline')} />
              </View>
            </NBCard>
          )
        ) : (
          extensionOrder
            .filter((id) => extensionEnabled[id])
            .map((id) => <View key={id}>{renderExtensionCard(id)}</View>)
        )}

        <NBCard>
          <View style={styles.rowBetween}>
            <ThemedText type="title">Extensions</ThemedText>
            <Ionicons name="grid" size={20} color={theme.textSecondary} />
          </View>
          <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
            Turn optional home cards on or off, and tell us what you&apos;d like next.
          </ThemedText>
          <View style={styles.cardButton}>
            <NBSecondaryButton title="Manage extensions" onPress={() => router.push('/extensions')} />
          </View>
        </NBCard>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  cardBody: { marginTop: 8, marginBottom: 4 },
  cardButton: { marginTop: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  habitEmpty: { marginTop: 10 },
  lastBoundImage: { width: '100%', height: 240, borderRadius: 14, marginTop: 8 },
  lastBoundMood: { marginTop: 8 },
  lastBoundMoodText: { fontWeight: '600' },
  petRowSpacing: { marginTop: 12 },
});
