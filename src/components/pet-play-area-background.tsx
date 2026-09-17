import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Rect, Stop } from 'react-native-svg';

// mirrors features/pet/petplayareaview.swift's PetPlayAreaBackground/PetNightStars — a
// 4-phase gradient (morning/day/evening/night) that re-checks the clock every 5 minutes,
// plus a scattering of stars at night. built on react-native-svg (already linked into the
// dev client via draw-and-guess.tsx) instead of expo-linear-gradient, which would need a
// fresh native build to add.
type DayPhase = 'morning' | 'day' | 'evening' | 'night';

const ORANGE = '#FF9500';
const PINK = '#FF2D55';
const INDIGO = '#5856D6';

function dayPhaseForHour(hour: number): DayPhase {
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function gradientStops(phase: DayPhase, accent: string): [{ color: string; opacity: number }, { color: string; opacity: number }] {
  switch (phase) {
    case 'morning':
      return [
        { color: ORANGE, opacity: 0.14 },
        { color: accent, opacity: 0.05 },
      ];
    case 'day':
      return [
        { color: accent, opacity: 0.12 },
        { color: accent, opacity: 0.04 },
      ];
    case 'evening':
      return [
        { color: ORANGE, opacity: 0.18 },
        { color: PINK, opacity: 0.08 },
      ];
    case 'night':
      return [
        { color: INDIGO, opacity: 0.3 },
        { color: INDIGO, opacity: 0.1 },
      ];
  }
}

function groundColor(phase: DayPhase, accent: string): { color: string; opacity: number } {
  return phase === 'night' ? { color: INDIGO, opacity: 0.16 } : { color: accent, opacity: 0.08 };
}

type Star = { xFrac: number; yFrac: number; radius: number; opacity: number };

function useNightStars(count = 24): Star[] {
  const [stars] = useState<Star[]>(() =>
    Array.from({ length: count }, () => ({
      xFrac: Math.random(),
      yFrac: Math.random() * 0.6,
      radius: 0.6 + Math.random() * 1.0,
      opacity: 0.25 + Math.random() * 0.45,
    }))
  );
  return stars;
}

export function PetPlayAreaBackground({ accent, width, height }: { accent: string; width: number; height: number }) {
  const [phase, setPhase] = useState<DayPhase>(() => dayPhaseForHour(new Date().getHours()));
  const stars = useNightStars();

  useEffect(() => {
    const id = setInterval(() => setPhase(dayPhaseForHour(new Date().getHours())), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (width === 0 || height === 0) return null;

  const [topStop, bottomStop] = gradientStops(phase, accent);
  const ground = groundColor(phase, accent);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="petAreaBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={topStop.color} stopOpacity={topStop.opacity} />
            <Stop offset="1" stopColor={bottomStop.color} stopOpacity={bottomStop.opacity} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#petAreaBg)" />
        {phase === 'night'
          ? stars.map((star, i) => (
              <Circle key={i} cx={star.xFrac * width} cy={star.yFrac * height} r={star.radius} fill="#FFFFFF" fillOpacity={star.opacity} />
            ))
          : null}
        <Ellipse cx={width / 2} cy={height - 64} rx={Math.max(0, (width - 48) / 2)} ry={40} fill={ground.color} fillOpacity={ground.opacity} />
      </Svg>
    </View>
  );
}
