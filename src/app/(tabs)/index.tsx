import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CyclePhaseBar } from '@/components/cycle-phase-bar';
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
import { fetchHabits, fetchTodaysCompletions, toggleHabitToday, type Habit, type HabitCompletion } from '@/lib/habits';
import { fetchPets } from '@/lib/pets';
import { getSignedUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

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

  // works solo pre-pairing and shows shared habits once merged
  const loadHabits = useCallback(async () => {
    try {
      const [habitRows, completionRows] = await Promise.all([fetchHabits(), fetchTodaysCompletions()]);
      setHabits(habitRows);
      setCompletions(completionRows);
    } catch {
      // home's habit card is a summary — timeline shows the real error state
    }
  }, []);

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

  // refetch every time the tab regains focus, not just on mount
  useFocusEffect(
    useCallback(() => {
      loadHabits();
      loadExtras();
    }, [loadHabits, loadExtras])
  );

  async function onToggle(habit: Habit, currentlyDone: boolean) {
    await toggleHabitToday(habit.id, !currentlyDone);
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
                  <ThemedText type="small" themeColor="accent" style={styles.lastBoundMood}>
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

        {(!couple || habits.length > 0) && (
          <NBCard>
            <View style={styles.rowBetween}>
              <ThemedText type="title">Today&apos;s habits</ThemedText>
              {habits.length > 0 ? (
                <Pressable onPress={() => router.push('/timeline')}>
                  <ThemedText type="link" themeColor="accent">
                    See all
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
            {habits.length === 0 ? (
              <>
                <ThemedText type="default" themeColor="textSecondary" style={styles.habitEmpty}>
                  {couple ? 'Track personal and shared habits together.' : "Start with personal habits—they'll merge when you connect."}
                </ThemedText>
                <View style={styles.cardButton}>
                  <NBSecondaryButton title="Open timeline" onPress={() => router.push('/timeline')} />
                </View>
              </>
            ) : (
              habits.slice(0, 3).map((habit) => {
                const doneToday =
                  completions.find((c) => c.habit_id === habit.id && c.user_id === session?.user.id)?.completed ?? false;
                return (
                  <Pressable key={habit.id} onPress={() => onToggle(habit, doneToday)} style={styles.habitRow}>
                    <Ionicons
                      name={doneToday ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={doneToday ? theme.accent : theme.textSecondary}
                    />
                    <ThemedText type="default" style={styles.habitLabel}>
                      {habit.title}
                    </ThemedText>
                  </Pressable>
                );
              })
            )}
          </NBCard>
        )}

        {couple ? (
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
        ) : null}

        {couple ? (
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
        ) : null}

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
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  habitLabel: { flex: 1 },
  lastBoundImage: { width: '100%', height: 240, borderRadius: 14, marginTop: 8 },
  lastBoundMood: { marginTop: 8 },
  petRowSpacing: { marginTop: 12 },
});
