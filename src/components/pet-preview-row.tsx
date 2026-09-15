import { StyleSheet, View } from 'react-native';

import { PetSprite } from '@/components/pet-sprite';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { UserPet } from '@/lib/database-types';
import { isPetSpeciesKey, previewScaleFor } from '@/lib/pet-species';

// mirrors features/pet/homepetcard.swift's petpreviewrow — two named sprite slots side by side,
// a dashed placeholder box with "?" for whichever partner hasn't adopted yet
export function PetPreviewRow({ myPet, partnerPet }: { myPet: UserPet | null; partnerPet: UserPet | null }) {
  return (
    <View style={styles.row}>
      <PetSlot pet={myPet} placeholder="Your pet" />
      <PetSlot pet={partnerPet} placeholder="Partner's pet" />
    </View>
  );
}

function PetSlot({ pet, placeholder }: { pet: UserPet | null; placeholder: string }) {
  const theme = useTheme();

  return (
    <View style={styles.slot}>
      <ThemedText type="smallBold" numberOfLines={1}>
        {pet?.name ?? placeholder}
      </ThemedText>
      {pet && isPetSpeciesKey(pet.species_key) ? (
        <PetSprite speciesKey={pet.species_key} animation="idle" scale={previewScaleFor(pet.species_key)} />
      ) : (
        <View style={[styles.placeholderBox, { borderColor: theme.textSecondary }]}>
          <ThemedText type="default" themeColor="textSecondary">
            ?
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end' },
  slot: { alignItems: 'center', gap: 6, flex: 1 },
  placeholderBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
});
