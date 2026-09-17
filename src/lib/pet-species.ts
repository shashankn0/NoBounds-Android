// real sprite sheets copied from ../nobounds/nobounds/core/assets/pets — same 8 species,
// same idle/walk frame layout (attack/hurt/death frames exist on ios but are unused there too)
export type PetSpeciesKey = 'dog_1' | 'dog_2' | 'cat_1' | 'cat_2' | 'rat_1' | 'rat_2' | 'bird_1' | 'bird_2';

export type PetAnimation = 'idle' | 'walk';

type SpeciesInfo = {
  label: string;
  frameSize: number; // native square frame size in px — 48 for dog/cat, 32 for rat/bird
  frames: Record<PetAnimation, number>;
  sheets: Record<PetAnimation, number>; // require() ids
};

export const PET_SPECIES: Record<PetSpeciesKey, SpeciesInfo> = {
  dog_1: {
    label: 'Dog',
    frameSize: 48,
    frames: { idle: 4, walk: 6 },
    sheets: {
      idle: require('../../assets/images/pets/dog_1_idle.png'),
      walk: require('../../assets/images/pets/dog_1_walk.png'),
    },
  },
  dog_2: {
    label: 'Dog (alt)',
    frameSize: 48,
    frames: { idle: 4, walk: 6 },
    sheets: {
      idle: require('../../assets/images/pets/dog_2_idle.png'),
      walk: require('../../assets/images/pets/dog_2_walk.png'),
    },
  },
  cat_1: {
    label: 'Cat',
    frameSize: 48,
    frames: { idle: 4, walk: 6 },
    sheets: {
      idle: require('../../assets/images/pets/cat_1_idle.png'),
      walk: require('../../assets/images/pets/cat_1_walk.png'),
    },
  },
  cat_2: {
    label: 'Cat (alt)',
    frameSize: 48,
    frames: { idle: 4, walk: 6 },
    sheets: {
      idle: require('../../assets/images/pets/cat_2_idle.png'),
      walk: require('../../assets/images/pets/cat_2_walk.png'),
    },
  },
  rat_1: {
    label: 'Rat',
    frameSize: 32,
    frames: { idle: 4, walk: 4 },
    sheets: {
      idle: require('../../assets/images/pets/rat_1_idle.png'),
      walk: require('../../assets/images/pets/rat_1_walk.png'),
    },
  },
  rat_2: {
    label: 'Rat (alt)',
    frameSize: 32,
    frames: { idle: 4, walk: 4 },
    sheets: {
      idle: require('../../assets/images/pets/rat_2_idle.png'),
      walk: require('../../assets/images/pets/rat_2_walk.png'),
    },
  },
  bird_1: {
    label: 'Bird',
    frameSize: 32,
    frames: { idle: 4, walk: 6 },
    sheets: {
      idle: require('../../assets/images/pets/bird_1_idle.png'),
      walk: require('../../assets/images/pets/bird_1_walk.png'),
    },
  },
  bird_2: {
    label: 'Bird (alt)',
    frameSize: 32,
    frames: { idle: 4, walk: 6 },
    sheets: {
      idle: require('../../assets/images/pets/bird_2_idle.png'),
      walk: require('../../assets/images/pets/bird_2_walk.png'),
    },
  },
};

export const PET_SPECIES_OPTIONS = Object.keys(PET_SPECIES) as PetSpeciesKey[];

export function isPetSpeciesKey(key: string): key is PetSpeciesKey {
  return key in PET_SPECIES;
}

// matches homepetcard.swift's previewscale(for:) — rat/bird render smaller natively so get a bigger scale
export function previewScaleFor(key: string): number {
  if (key === 'rat_1' || key === 'rat_2' || key === 'bird_1' || key === 'bird_2') return 2.5;
  return 2;
}

// matches ambientpetentity.swift's speciesScale — the larger scale used for the free-roaming
// play area sprite, as opposed to the smaller static preview-row scale above
export function playAreaScaleFor(key: string): number {
  if (key === 'rat_1' || key === 'rat_2' || key === 'bird_1' || key === 'bird_2') return 2.6;
  return 2.2;
}
