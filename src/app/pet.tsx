import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { PetSprite } from '@/components/pet-sprite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import type { UserPet } from '@/lib/database-types';
import { isPetSpeciesKey, PET_SPECIES, PET_SPECIES_OPTIONS, previewScaleFor, profileScaleFor, type PetSpeciesKey } from '@/lib/pet-species';
import { fetchPets, petMood, recordPetCare } from '@/lib/pets';
import { errorMessage, supabase } from '@/lib/supabase';

// mirrors mockpetrepository.swift's bio normalization: trimmed, empty string becomes null
function normalizedBio(bio: string): string | null {
  const trimmed = bio.trim();
  return trimmed.length === 0 ? null : trimmed;
}

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

  // which care action is in flight, if any — either partner can feed/play with either pet
  const [caring, setCaring] = useState<'feed' | 'play' | null>(null);

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
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewedPet?.id])
  );

  const hasEdits = !!viewedPet && (editName !== viewedPet.name || normalizedBio(editBio) !== (viewedPet.bio ?? null));
  const canSaveEdits = editName.trim().length > 0;
  const hasPendingEdits = isOwn && hasEdits;

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
    if (!viewedPet || caring) return;
    setCaring(action);
    try {
      await recordPetCare(viewedPet.id, action);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update pet');
    } finally {
      setCaring(null);
    }
  }

  async function onSaveAbout() {
    if (!viewedPet || !canSaveEdits) return;
    setEditSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('user_pets')
        .update({ name: editName.trim(), bio: normalizedBio(editBio), updated_at: new Date().toISOString() })
        .eq('id', viewedPet.id);
      if (updateError) throw updateError;
      await load();
      router.back();
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
      <FormHeader
        title={viewedPet.name}
        rightLabel={hasPendingEdits ? (editSaving ? 'Saving…' : 'Save') : 'Done'}
        rightDisabled={hasPendingEdits ? editSaving || !canSaveEdits : false}
        onRightPress={hasPendingEdits ? onSaveAbout : () => router.back()}
      />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.centered}>
          {speciesInfo ? (
            <PetSprite speciesKey={viewedPet.species_key as PetSpeciesKey} animation="idle" scale={profileScaleFor(viewedPet.species_key)} />
          ) : null}
          <ThemedText type="smallBold">{speciesInfo?.label ?? viewedPet.species_key}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Adopted {new Date(viewedPet.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </ThemedText>
        </View>

        <NBCard>
          <ThemedText type="subtitle" style={styles.sectionLabel}>
            Care
          </ThemedText>
          <MeterRow icon="restaurant" label="Fullness" value={mood.fullness} theme={theme} />
          <MeterRow icon="heart" label="Happiness" value={mood.happiness} theme={theme} />
          <View style={styles.careButtons}>
            <CareButton icon="restaurant" title="Feed" busy={caring === 'feed'} disabled={!!caring} onPress={() => onCare('feed')} theme={theme} />
            <CareButton icon="walk" title="Play" busy={caring === 'play'} disabled={!!caring} onPress={() => onCare('play')} theme={theme} />
          </View>
          {!isOwn ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
              Caring for {viewedPet.name} lets your partner know you stopped by.
            </ThemedText>
          ) : null}
        </NBCard>

        <NBCard>
          <ThemedText type="subtitle" style={styles.sectionLabel}>
            About
          </ThemedText>
          {isOwn ? (
            <View style={styles.aboutFields}>
              <View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
                  Name
                </ThemedText>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Name"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
                />
              </View>
              <View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
                  Bio
                </ThemedText>
                <TextInput
                  value={editBio}
                  onChangeText={(t) => setEditBio(t.slice(0, 80))}
                  placeholder="A short description (80 characters max)"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
                />
              </View>
            </View>
          ) : (
            <ThemedText type="default" themeColor="textSecondary">
              {viewedPet.bio ?? `${viewedPet.name} doesn't have a bio yet.`}
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

function MeterRow({
  icon,
  label,
  value,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.meterRow}>
      <Ionicons name={icon} size={15} color={theme.accent} style={styles.meterIcon} />
      <ThemedText type="small" style={styles.meterLabel}>
        {label}
      </ThemedText>
      <View style={[styles.meterTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.meterFill, { width: `${Math.max(4, value * 100)}%`, backgroundColor: theme.accent }]} />
      </View>
    </View>
  );
}

function CareButton({
  icon,
  title,
  onPress,
  busy,
  disabled,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.careButton, { backgroundColor: theme.accent + '24', opacity: disabled && !busy ? 0.5 : 1 }]}>
      {busy ? <ActivityIndicator size="small" color={theme.accent} /> : <Ionicons name={icon} size={15} color={theme.accent} />}
      <ThemedText type="smallBold" themeColor="accent">
        {title}
      </ThemedText>
    </Pressable>
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
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  aboutFields: { gap: 12 },
  fieldLabel: { marginBottom: 6, fontWeight: '600' },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  meterIcon: { width: 18, textAlign: 'center' },
  meterLabel: { width: 70 },
  meterTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 3 },
  careButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  careButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
});
