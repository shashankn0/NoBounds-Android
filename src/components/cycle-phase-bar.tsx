import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { CYCLE_PHASE_LABEL, CYCLE_PHASES, type CyclePhase } from '@/lib/cycle-tracking';

// mirrors features/cycletracking/components/cyclephaseprogressbar.swift
export function CyclePhaseBar({ phase, progress }: { phase: CyclePhase; progress: number }) {
  const theme = useTheme();
  const fillColor = PHASE_COLOR[phase](theme.accent);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <ThemedText type="smallBold">{CYCLE_PHASE_LABEL[phase]}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {Math.round(progress * 100)}%
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View style={[styles.fill, { width: `${Math.max(4, progress * 100)}%`, backgroundColor: fillColor }]} />
      </View>
      <View style={styles.labelsRow}>
        {CYCLE_PHASES.map((p) => (
          <ThemedText
            key={p}
            type="small"
            style={[styles.labelItem, { color: p === phase ? theme.accent : theme.textSecondary }]}>
            {CYCLE_PHASE_LABEL[p]}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

// no dedicated per-phase tokens on android yet — accent for menstrual, plain shades for the rest
const PHASE_COLOR: Record<CyclePhase, (accent: string) => string> = {
  menstrual: (accent) => accent,
  follicular: () => '#7CA9E8',
  ovulation: () => '#5FC98D',
  luteal: () => '#B98BD6',
};

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  labelsRow: { flexDirection: 'row' },
  labelItem: { flex: 1, textAlign: 'center', fontSize: 11 },
});
