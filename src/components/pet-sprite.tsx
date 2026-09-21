import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

import { PET_SPECIES, type PetAnimation, type PetSpeciesKey } from '@/lib/pet-species';

const FPS = 8;

type PetSpriteProps = {
  speciesKey: PetSpeciesKey;
  animation?: PetAnimation;
  scale?: number;
  flipHorizontally?: boolean;
  // freezes the sprite on its first frame — mirrors ios's PetSpriteView `paused` (used while napping)
  paused?: boolean;
};

// mirrors core/pet/petspriteview.swift — crops one frame out of a horizontal sprite-sheet png,
// advancing frames on a timer instead of swift's timelineview(.animation(...))
export function PetSprite({ speciesKey, animation = 'idle', scale = 2, flipHorizontally = false, paused = false }: PetSpriteProps) {
  const [frame, setFrame] = useState(0);
  const info = PET_SPECIES[speciesKey];
  const frameCount = info.frames[animation];
  // tab screens stay mounted when you leave them, so an unfocused sprite must stop ticking — four
  // sprites at 8fps each were a constant background re-render load on the js thread
  const focused = useIsFocused();

  useEffect(() => {
    if (paused || !focused) return;
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % frameCount);
    }, 1000 / FPS);
    return () => clearInterval(id);
  }, [frameCount, speciesKey, animation, paused, focused]);

  const size = info.frameSize * scale;
  const sheetWidth = info.frameSize * frameCount * scale;
  const shownFrame = paused ? 0 : frame;

  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }}>
      <Image
        source={info.sheets[animation]}
        style={{
          width: sheetWidth,
          height: size,
          transform: [{ translateX: -shownFrame * size }, { scaleX: flipHorizontally ? -1 : 1 }],
        }}
        resizeMode="stretch"
      />
    </View>
  );
}
