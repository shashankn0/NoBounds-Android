import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton, NBSecondaryButton } from '@/components/nb-button';
import { PetSprite } from '@/components/pet-sprite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import type { UserPet } from '@/lib/database-types';
import { isPetSpeciesKey, PET_SPECIES, PET_SPECIES_OPTIONS, previewScaleFor, type PetSpeciesKey } from '@/lib/pet-species';
import { fetchPets, petMood, recordPetCare } from '@/lib/pets';
import { errorMessage, supabase } from '@/lib/supabase';

export default function PetScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { petId } = useLocalSearchParams<{ petId?: string }>();
  const { session, couple } = useSession();
  const [pets, setPets] = useState<UserPet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // adopt form state
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [species, setSpecies] = useState<PetSpeciesKey>('dog_1');
  const [saving, setSaving] = useState(false);

  // editable-name/bio state for an already-adopted pet
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);

  const load = useCallback(async () => {
    if (!couple) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPets(couple.id);
      setPets(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pets');
    } finally {
      setLoading(false);
    }
  }, [couple]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const myPet = pets.find((p) => p.user_id === session?.user.id) ?? null;
  const viewedPet = petId ? (pets.find((p) => p.id === petId) ?? null) : myPet;
  const isOwn = !!viewedPet && viewedPet.user_id === session?.user.id;

  useFocusEffect(
    useCallback(() => {
      if (viewedPet) {
        setEditName(viewedPet.name);
        setEditBio(viewedPet.bio ?? '');
        setEditSaved(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewedPet?.id])
  );

  async function onAdopt() {
    if (!couple || !session || name.trim().length === 0) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase
      .from('user_pets')
      .insert({ user_id: session.user.id, couple_id: couple.id, species_key: species, name: name.trim(), bio: bio.trim() || null });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setName('');
    setBio('');
    await load();
  }

  async function onCare(action: 'feed' | 'play') {
    if (!myPet) return;
    try {
      await recordPetCare(myPet.id, action);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update pet');
    }
  }

  async function onSaveAbout() {
    if (!viewedPet || editName.trim().length === 0) return;
    setEditSaving(true);
    setEditSaved(false);
    try {
      const { error: updateError } = await supabase
        .from('user_pets')
        .update({ name: editName.trim(), bio: editBio.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', viewedPet.id);
      if (updateError) throw updateError;
      setEditSaved(true);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not save'));
    } finally {
      setEditSaving(false);
    }
  }

  if (!couple) {
    return (
      <ThemedView style={styles.container}>
        <FormHeader title="Pet" leftLabel="Close" onLeftPress={() => router.back()} />
        <ThemedText type="default" themeColor="textSecondary" style={styles.centerPad}>
          Pets unlock once you connect with your partner.
        </ThemedText>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <FormHeader title="Pet" leftLabel="Close" onLeftPress={() => router.back()} />
        <ThemedText type="default" themeColor="textSecondary" style={styles.centerPad}>
          Loading…
        </ThemedText>
      </ThemedView>
    );
  }

  // no petId requested and I haven't adopted yet -> show the adopt flow
  if (!viewedPet && !petId) {
    return (
      <ThemedView style={styles.container}>
        <FormHeader title="Adopt a pet" leftLabel="Close" onLeftPress={() => router.back()} />
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]}>
          <NBCard>
            <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
              This choice is permanent for now — pick a companion and give it a name.
            </ThemedText>
            <View style={styles.speciesGrid}>
              {PET_SPECIES_OPTIONS.map((key) => (
                <Pressable
                  key={key}
                  onPress={() => setSpecies(key)}
                  style={[styles.speciesTile, { borderColor: species === key ? theme.accent : theme.border }]}>
                  <PetSprite speciesKey={key} animation="idle" scale={previewScaleFor(key)} />
                  <ThemedText type="small">{PET_SPECIES[key].label}</ThemedText>
                </Pressable>
              ))}
            </View>
            <TextInput
              placeholder="Name"
              placeholderTextColor={theme.textSecondary}
              value={name}
              onChangeText={setName}
              style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
            />
            <TextInput
              placeholder="Bio (optional, 80 characters max)"
              placeholderTextColor={theme.textSecondary}
              value={bio}
              onChangeText={(t) => setBio(t.slice(0, 80))}
              style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
            />
            <View style={styles.body}>
              <NBPrimaryButton title={saving ? 'Adopting…' : 'Adopt pet'} onPress={onAdopt} disabled={saving || name.trim().length === 0} />
            </View>
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

  if (!viewedPet) {
    return (
      <ThemedView style={styles.container}>
        <FormHeader title="Pet" leftLabel="Close" onLeftPress={() => router.back()} />
        <ThemedText type="default" themeColor="textSecondary" style={styles.centerPad}>
          That pet couldn&apos;t be found.
        </ThemedText>
      </ThemedView>
    );
  }

  const mood = petMood(viewedPet);
  const speciesInfo = isPetSpeciesKey(viewedPet.species_key) ? PET_SPECIES[viewedPet.species_key] : undefined;

  return (
    <ThemedView style={styles.container}>
      <FormHeader title={viewedPet.name} leftLabel="Close" onLeftPress={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.centered}>
          {speciesInfo ? (
            <PetSprite speciesKey={viewedPet.species_key as PetSpeciesKey} animation="idle" scale={previewScaleFor(viewedPet.species_key) * 2.2} />
          ) : null}
          <ThemedText type="title">{viewedPet.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {speciesInfo?.label ?? viewedPet.species_key} · Adopted{' '}
            {new Date(viewedPet.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </ThemedText>
        </View>

        <NBCard>
          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
            Care
          </ThemedText>
          <MeterRow label="Fullness" value={mood.fullness} theme={theme} />
          <MeterRow label="Happiness" value={mood.happiness} theme={theme} />
          {isOwn ? (
            <View style={styles.careButtons}>
              <View style={styles.careButton}>
                <NBSecondaryButton title="Feed" onPress={() => onCare('feed')} />
              </View>
              <View style={styles.careButton}>
                <NBSecondaryButton title="Play" onPress={() => onCare('play')} />
              </View>
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
              Caring for {viewedPet.name} lets your partner know you stopped by.
            </ThemedText>
          )}
        </NBCard>

        <NBCard>
          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
            About
          </ThemedText>
          {isOwn ? (
            <>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Name"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
              />
              <TextInput
                value={editBio}
                onChangeText={(t) => setEditBio(t.slice(0, 80))}
                placeholder="Bio (80 characters max)"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
              />
              <View style={styles.body}>
                <NBPrimaryButton
                  title={editSaving ? 'Saving…' : 'Save'}
                  onPress={onSaveAbout}
                  disabled={editSaving || editName.trim().length === 0}
                />
              </View>
              {editSaved ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
                  Saved.
                </ThemedText>
              ) : null}
            </>
          ) : (
            <ThemedText type="default" themeColor="textSecondary">
              {viewedPet.bio ?? 'No bio yet.'}
            </ThemedText>
          )}
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

function MeterRow({ label, value, theme }: { label: string; value: number; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.meterRow}>
      <View style={styles.meterHeader}>
        <ThemedText type="small">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {Math.round(value * 100)}%
        </ThemedText>
      </View>
      <View style={[styles.meterTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.meterFill, { width: `${Math.max(4, value * 100)}%`, backgroundColor: theme.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  centerPad: { padding: 20 },
  centered: { alignItems: 'center', gap: 4, marginBottom: 4 },
  body: { marginTop: 8 },
  sectionLabel: { marginBottom: 8 },
  speciesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: 8 },
  speciesTile: {
    width: '30%',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: Spacing.two,
  },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginTop: 8 },
  meterRow: { marginBottom: 12, gap: 6 },
  meterHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  meterTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 4 },
  careButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  careButton: { flex: 1 },
});
