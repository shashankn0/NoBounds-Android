import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { PetPlayAreaBackground } from '@/components/pet-play-area-background';
import { PetSprite } from '@/components/pet-sprite';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { UserPet } from '@/lib/database-types';
import { isPetSpeciesKey, PET_SPECIES, playAreaScaleFor } from '@/lib/pet-species';

type Point = { x: number; y: number };

type PetPlayAreaProps = {
  pets: UserPet[];
  messageByUserId: Record<string, string | undefined>;
  onSelectPet: (pet: UserPet) => void;
};

// loosely based on ios's PetPlayAreaModel (pause, walk to a random point over smooth-stepped
// frames, greet the other pet when close, chase a dropped toy) but paced slower/calmer than
// ios's own 1.2-2.8s pause + 12fps walk, which read as too fast/constant on a phone-sized
// play area. also adds a random chance to settle into a longer daytime nap between wanders
// (paused sprite + "Zzz" bubble, reusing the same visual ios only uses for night/away naps)
// — not something ios's own model does, called out here since it's a deliberate addition.
// still not ported: partner-presence-based napping (needs a partner "last opened app"
// timestamp this app doesn't track yet) — night-rest hours still apply since that's a
// purely local-clock check.
const STEPS = 24;
const STEP_MS = 1000 / 9;
const PAUSE_MIN_MS = 2600;
const PAUSE_MAX_MS = 5600;
const GREETING_DISTANCE = 70;
const GREETING_COOLDOWN_MS = 20_000;
const NIGHT_REST_HOURS = new Set([23, 0, 1, 2, 3, 4, 5]);
const H_MARGIN = 40;
const V_MARGIN = 56;
const DAYTIME_NAP_CHANCE = 0.3;
const DAYTIME_NAP_MIN_MS = 7000;
const DAYTIME_NAP_MAX_MS = 14000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function hypot(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function PetPlayArea({ pets, messageByUserId, onSelectPet }: PetPlayAreaProps) {
  const theme = useTheme();
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [facing, setFacing] = useState<Record<string, boolean>>({});
  const [animations, setAnimations] = useState<Record<string, 'idle' | 'walk'>>({});
  const [daytimeSleep, setDaytimeSleep] = useState<Record<string, boolean>>({});
  const [toy, setToy] = useState<(Point & { id: number }) | null>(null);
  const [greetingPoint, setGreetingPoint] = useState<Point | null>(null);
  const [isNightRest] = useState(() => NIGHT_REST_HOURS.has(new Date().getHours()));

  // one "generation" number per pet — bumping it makes any in-flight loop for that pet notice
  // it's been superseded (a new wander cycle, or a toy chase) and stop, even after an `await`
  const generationRef = useRef<Record<string, number>>({});
  const positionsRef = useRef(positions);
  const boundsRef = useRef(bounds);
  const isGreetingActiveRef = useRef(false);
  const greetingCooldownUntilRef = useRef(0);

  // keep the ref mirrors in sync after each commit — the async wander/greeting/chase loops read
  // these refs instead of `positions`/`bounds` state directly so they never see a stale closure
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);
  useEffect(() => {
    boundsRef.current = bounds;
  }, [bounds]);

  function horizontalRange(): [number, number] {
    const lower = H_MARGIN;
    const upper = boundsRef.current.width - H_MARGIN;
    return lower < upper ? [lower, upper] : [boundsRef.current.width / 2, boundsRef.current.width / 2];
  }

  function verticalRange(): [number, number] {
    const lower = V_MARGIN;
    const upper = boundsRef.current.height - V_MARGIN;
    return lower < upper ? [lower, upper] : [boundsRef.current.height / 2, boundsRef.current.height / 2];
  }

  function randomPoint(): Point {
    const [hx0, hx1] = horizontalRange();
    const [vy0, vy1] = verticalRange();
    return { x: hx0 + Math.random() * (hx1 - hx0), y: vy0 + Math.random() * (vy1 - vy0) };
  }

  function clampPoint(p: Point): Point {
    const [hx0, hx1] = horizontalRange();
    const [vy0, vy1] = verticalRange();
    return { x: Math.min(Math.max(p.x, hx0), hx1), y: Math.min(Math.max(p.y, vy0), vy1) };
  }

  async function movePet(petId: string, target: Point, gen: number) {
    const start = positionsRef.current[petId] ?? target;
    setFacing((prev) => ({ ...prev, [petId]: target.x >= start.x }));
    setAnimations((prev) => ({ ...prev, [petId]: 'walk' }));
    for (let step = 1; step <= STEPS; step++) {
      if (generationRef.current[petId] !== gen || isGreetingActiveRef.current) return;
      const t = smoothstep(step / STEPS);
      const next = { x: start.x + (target.x - start.x) * t, y: start.y + (target.y - start.y) * t };
      positionsRef.current = { ...positionsRef.current, [petId]: next };
      setPositions((prev) => ({ ...prev, [petId]: next }));
      await sleep(STEP_MS);
    }
  }

  function shouldGreet(): boolean {
    if (isGreetingActiveRef.current || Date.now() < greetingCooldownUntilRef.current) return false;
    if (pets.length !== 2) return false;
    const [a, b] = pets;
    const pa = positionsRef.current[a.id];
    const pb = positionsRef.current[b.id];
    if (!pa || !pb) return false;
    return hypot(pa, pb) <= GREETING_DISTANCE;
  }

  async function performGreeting() {
    isGreetingActiveRef.current = true;
    setAnimations((prev) => {
      const next = { ...prev };
      for (const p of pets) next[p.id] = 'idle';
      return next;
    });
    if (pets.length === 2) {
      const [a, b] = pets;
      const pa = positionsRef.current[a.id];
      const pb = positionsRef.current[b.id];
      if (pa && pb) {
        setFacing((prev) => ({ ...prev, [a.id]: pb.x >= pa.x, [b.id]: pa.x >= pb.x }));
        setGreetingPoint({ x: (pa.x + pb.x) / 2, y: Math.min(pa.y, pb.y) - 40 });
      }
    }
    await sleep(2500);
    setGreetingPoint(null);
    greetingCooldownUntilRef.current = Date.now() + GREETING_COOLDOWN_MS;
    isGreetingActiveRef.current = false;
  }

  async function wanderLoop(petId: string, gen: number) {
    while (generationRef.current[petId] === gen) {
      const pause = PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS);
      await sleep(pause);
      if (generationRef.current[petId] !== gen) return;
      if (isGreetingActiveRef.current) continue;

      // sometimes settle down for a short rest instead of wandering off again
      if (Math.random() < DAYTIME_NAP_CHANCE) {
        setDaytimeSleep((prev) => ({ ...prev, [petId]: true }));
        await sleep(DAYTIME_NAP_MIN_MS + Math.random() * (DAYTIME_NAP_MAX_MS - DAYTIME_NAP_MIN_MS));
        if (generationRef.current[petId] !== gen) return;
        setDaytimeSleep((prev) => ({ ...prev, [petId]: false }));
        continue;
      }

      await movePet(petId, randomPoint(), gen);
      if (generationRef.current[petId] !== gen) return;
      setAnimations((prev) => ({ ...prev, [petId]: 'idle' }));

      if (shouldGreet()) {
        await performGreeting();
        if (generationRef.current[petId] !== gen) return;
      }
    }
  }

  function startWander(petId: string) {
    const gen = (generationRef.current[petId] ?? 0) + 1;
    generationRef.current[petId] = gen;
    wanderLoop(petId, gen);
  }

  async function chaseToy(petId: string, target: Point, toyId: number, gen: number) {
    await movePet(petId, target, gen);
    if (generationRef.current[petId] !== gen) return;
    setAnimations((prev) => ({ ...prev, [petId]: 'idle' }));
    await sleep(800);
    if (generationRef.current[petId] !== gen) return;
    setToy((prev) => (prev?.id === toyId ? null : prev));
    wanderLoop(petId, gen);
  }

  function isNapping(pet: UserPet) {
    return isNightRest || !!daytimeSleep[pet.id];
  }

  function onDropToy(e: GestureResponderEvent) {
    if (toy) return;
    const point = clampPoint({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });
    const toyId = Date.now();
    setToy({ ...point, id: toyId });

    const awake = pets.filter((p) => !isNapping(p) && positionsRef.current[p.id]);
    if (awake.length === 0) {
      setTimeout(() => setToy((prev) => (prev?.id === toyId ? null : prev)), 2000);
      return;
    }
    const nearest = awake.reduce((best, p) =>
      hypot(positionsRef.current[p.id], point) < hypot(positionsRef.current[best.id], point) ? p : best
    );
    const gen = (generationRef.current[nearest.id] ?? 0) + 1;
    generationRef.current[nearest.id] = gen;
    chaseToy(nearest.id, point, toyId, gen);
  }

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setBounds({ width, height });
  }

  // (re)seed positions and (re)start wander loops once bounds + the pet roster are known
  useEffect(() => {
    if (bounds.width === 0 || bounds.height === 0 || pets.length === 0) return;

    setPositions((prev) => {
      const next = { ...prev };
      for (const pet of pets) {
        next[pet.id] = next[pet.id] ? clampPoint(next[pet.id]) : randomPoint();
      }
      return next;
    });
    setFacing((prev) => {
      const next = { ...prev };
      for (const pet of pets) if (next[pet.id] === undefined) next[pet.id] = true;
      return next;
    });

    for (const pet of pets) {
      if (isNightRest) {
        generationRef.current[pet.id] = (generationRef.current[pet.id] ?? 0) + 1;
        setAnimations((prev) => ({ ...prev, [pet.id]: 'idle' }));
      } else if (!generationRef.current[pet.id]) {
        startWander(pet.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.width, bounds.height, pets.map((p) => p.id).join(',')]);

  // stop every loop on unmount
  useEffect(
    () => () => {
      for (const id of Object.keys(generationRef.current)) {
        generationRef.current[id] = (generationRef.current[id] ?? 0) + 1;
      }
    },
    []
  );

  return (
    <Pressable style={[styles.area, { backgroundColor: theme.backgroundSecondary }]} onLayout={onLayout} onPress={onDropToy}>
      <PetPlayAreaBackground accent={theme.accent} width={bounds.width} height={bounds.height} />

      {toy ? (
        <View pointerEvents="none" style={[styles.toy, { left: toy.x - 8, top: toy.y - 8, backgroundColor: theme.accent }]} />
      ) : null}

      {pets.map((pet) => {
        const position = positions[pet.id];
        if (!position) return null;
        const napping = isNapping(pet);
        const message = messageByUserId[pet.user_id];
        const scale = isPetSpeciesKey(pet.species_key) ? playAreaScaleFor(pet.species_key) : 2.5;
        const spriteSize = (isPetSpeciesKey(pet.species_key) ? PET_SPECIES[pet.species_key].frameSize : 48) * scale;

        return (
          <PetEntity
            key={pet.id}
            pet={pet}
            position={position}
            spriteSize={spriteSize}
            napping={napping}
            message={message}
            facingRight={facing[pet.id] ?? true}
            animation={napping ? 'idle' : animations[pet.id] === 'walk' ? 'walk' : 'idle'}
            scale={scale}
            onSelectPet={onSelectPet}
          />
        );
      })}

      {greetingPoint ? (
        <Ionicons
          name="heart"
          size={18}
          color={theme.accent}
          style={[styles.greetingHeart, { left: greetingPoint.x - 9, top: greetingPoint.y - 9 }]}
        />
      ) : null}
    </Pressable>
  );
}

function PetEntity({
  pet,
  position,
  spriteSize,
  napping,
  message,
  facingRight,
  animation,
  scale,
  onSelectPet,
}: {
  pet: UserPet;
  position: Point;
  spriteSize: number;
  napping: boolean;
  message: string | undefined;
  facingRight: boolean;
  animation: 'idle' | 'walk';
  scale: number;
  onSelectPet: (pet: UserPet) => void;
}) {
  const theme = useTheme();
  const hopOffset = useSharedValue(0);
  const [burstId, setBurstId] = useState(0);
  const [burstVisible, setBurstVisible] = useState(false);

  // mirrors ambientpetentity.swift's triggerReaction: a quick spring hop plus a heart burst
  function onTap() {
    hopOffset.value = withSequence(withSpring(-16, { damping: 8, stiffness: 300 }), withSpring(0, { damping: 10, stiffness: 220 }));
    setBurstId((id) => id + 1);
    setBurstVisible(true);
    setTimeout(() => setBurstVisible(false), 1000);
  }

  const hopStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hopOffset.value }] }));

  return (
    <View pointerEvents="box-none" style={[styles.petWrap, { left: position.x - spriteSize / 2, top: position.y - spriteSize / 2 }]}>
      {napping ? <Bubble text="Zzz" muted /> : message ? <Bubble text={message} /> : null}
      <Animated.View style={hopStyle}>
        <Pressable onPress={onTap} style={styles.petSprite}>
          {isPetSpeciesKey(pet.species_key) ? (
            <PetSprite speciesKey={pet.species_key} animation={animation} scale={scale} flipHorizontally={!facingRight} paused={napping} />
          ) : null}
        </Pressable>
      </Animated.View>
      {burstVisible ? <HeartBurst key={burstId} /> : null}
      <Pressable onPress={() => onSelectPet(pet)} style={[styles.nameTag, { backgroundColor: theme.surface }]}>
        <ThemedText type="small" numberOfLines={1}>
          {pet.name}
        </ThemedText>
      </Pressable>
    </View>
  );
}

// mirrors ambientpetentity.swift's HeartBurstView: 3 hearts fanned out, floating up and
// fading over ~0.9s with a slight stagger
function HeartBurst() {
  return (
    <View pointerEvents="none" style={styles.heartBurstWrap}>
      {[0, 1, 2].map((index) => (
        <HeartParticle key={index} index={index} />
      ))}
    </View>
  );
}

function HeartParticle({ index }: { index: number }) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(index * 80, withTiming(1, { duration: 900 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: (index - 1) * 14 }, { translateY: -6 + progress.value * (-40 - index * 8) }],
    opacity: 1 - progress.value,
  }));

  return (
    <Animated.View style={[styles.heartParticle, style]}>
      <Ionicons name="heart" size={11} color={theme.accent} />
    </Animated.View>
  );
}

function Bubble({ text, muted = false }: { text: string; muted?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.bubbleWrap}>
      <View style={[styles.bubble, { backgroundColor: theme.surface }]}>
        <ThemedText type="small" themeColor={muted ? 'textSecondary' : 'textPrimary'} numberOfLines={2} style={styles.bubbleText}>
          {text}
        </ThemedText>
      </View>
      <View style={[styles.bubbleTail, { borderTopColor: theme.surface }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  area: { minHeight: 300, borderRadius: 20, overflow: 'hidden' },
  toy: { position: 'absolute', width: 16, height: 16, borderRadius: 8 },
  petWrap: { position: 'absolute', alignItems: 'center' },
  petSprite: { alignItems: 'center', justifyContent: 'center' },
  nameTag: { marginTop: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, maxWidth: 90 },
  bubbleWrap: { alignItems: 'center', marginBottom: 4 },
  bubble: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, maxWidth: 140 },
  bubbleText: { textAlign: 'center' },
  bubbleTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  greetingHeart: { position: 'absolute' },
  heartBurstWrap: { position: 'absolute', top: -6, alignItems: 'center', justifyContent: 'center' },
  heartParticle: { position: 'absolute' },
});
