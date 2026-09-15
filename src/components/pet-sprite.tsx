import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

import { PET_SPECIES, type PetAnimation, type PetSpeciesKey } from '@/lib/pet-species';

const FPS = 8;

type PetSpriteProps = {
  speciesKey: PetSpeciesKey;
  animation?: PetAnimation;
  scale?: number;
};

// mirrors core/pet/petspriteview.swift — crops one frame out of a horizontal sprite-sheet png,
// advancing frames on a timer instead of swift's timelineview(.animation(...))
export function PetSprite({ speciesKey, animation = 'idle', scale = 2 }: PetSpriteProps) {
  const [frame, setFrame] = useState(0);
  const info = PET_SPECIES[speciesKey];
  const frameCount = info.frames[animation];

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % frameCount);
    }, 1000 / FPS);
    return () => clearInterval(id);
  }, [frameCount, speciesKey, animation]);

  const size = info.frameSize * scale;
  const sheetWidth = info.frameSize * frameCount * scale;

  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }}>
      <Image
        source={info.sheets[animation]}
        style={{
          width: sheetWidth,
          height: size,
          transform: [{ translateX: -frame * size }],
        }}
        resizeMode="stretch"
      />
    </View>
  );
}
