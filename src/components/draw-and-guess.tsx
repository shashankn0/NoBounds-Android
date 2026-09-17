import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton, NBSecondaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// ios plays this pass-the-phone: one device, players take turns handing it back and forth —
// no live connection, no backend table, nothing persisted. round state is plain local state.
const WORDS = ['pizza', 'guitar', 'umbrella', 'castle', 'rainbow', 'robot', 'volcano', 'penguin', 'bicycle', 'lighthouse'];

type Point = { x: number; y: number };
type Stroke = Point[];
type RoundResult = { word: string; correct: boolean };

function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

export function DrawAndGuess() {
  const theme = useTheme();
  const [roundNumber, setRoundNumber] = useState(1);
  const [word, setWord] = useState(randomWord);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const strokeCountRef = useRef(0);

  // round 1 = Player 1 draws, round 2 = Player 2, alternating — whoever is holding the phone
  // this round is always the drawer, so there's nothing to pick ahead of time
  const drawerIsPlayerOne = roundNumber % 2 === 1;

  const panResponder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- strokeCountRef is only read/written from real touch events, never during render
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          strokeCountRef.current += 1;
          setStrokes((prev) => [...prev, [{ x: locationX, y: locationY }]]);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const strokeIndex = strokeCountRef.current - 1;
          setStrokes((prev) => {
            const next = [...prev];
            next[strokeIndex] = [...next[strokeIndex], { x: locationX, y: locationY }];
            return next;
          });
        },
      }),
    []
  );

  function onUndo() {
    setStrokes((prev) => prev.slice(0, -1));
    strokeCountRef.current = Math.max(0, strokeCountRef.current - 1);
  }

  function onClear() {
    setStrokes([]);
    strokeCountRef.current = 0;
  }

  function onGotIt() {
    setTotalCorrect((n) => n + 1);
    setRoundResult({ word, correct: true });
  }

  function onDone() {
    setRoundResult({ word, correct: false });
  }

  function onNextRound() {
    setRoundNumber((n) => n + 1);
    setRoundResult(null);
    setWord(randomWord());
    setStrokes([]);
    strokeCountRef.current = 0;
  }

  if (roundResult) {
    const nextDrawerIsPlayerOne = (roundNumber + 1) % 2 === 1;
    return (
      <View style={styles.resultScreen}>
        <Ionicons name={roundResult.correct ? 'checkmark-circle' : 'bulb'} size={44} color={theme.accent} />
        <ThemedText type="title" style={styles.centeredText}>
          {roundResult.correct ? 'Got it!' : 'So close!'}
        </ThemedText>
        <ThemedText type="default" style={styles.centeredText}>
          The word was &ldquo;{roundResult.word}&rdquo;.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
          {totalCorrect} guessed right in {roundNumber} round{roundNumber === 1 ? '' : 's'}.
        </ThemedText>
        <View style={styles.resultButton}>
          <NBPrimaryButton
            title={`Next round — Player ${nextDrawerIsPlayerOne ? 1 : 2} draws`}
            onPress={onNextRound}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.roundRow}>
        <ThemedText type="smallBold">Round {roundNumber}</ThemedText>
        <ThemedText type="smallBold" themeColor="accent">
          Guessed: {totalCorrect}
        </ThemedText>
      </View>

      <NBCard style={styles.wordCard}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
          Draw this — don&apos;t say it out loud!
        </ThemedText>
        <ThemedText type="title" themeColor="accent" style={styles.centeredText}>
          {word}
        </ThemedText>
      </NBCard>

      <View style={[styles.canvas, { backgroundColor: theme.surface }]} {...panResponder.panHandlers}>
        <Svg width="100%" height="100%">
          {strokes.map((stroke, i) => (
            <Polyline
              key={i}
              points={stroke.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={theme.textPrimary}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      </View>

      <View style={styles.toolRow}>
        <View style={styles.toolButton}>
          <NBSecondaryButton title="Undo" onPress={onUndo} disabled={strokes.length === 0} />
        </View>
        <View style={styles.toolButton}>
          <NBSecondaryButton title="Clear" onPress={onClear} disabled={strokes.length === 0} />
        </View>
      </View>

      {/* two distinct endings: the other person actually said the word, or the drawer gives up
          and hands the phone over anyway — ios only shows the give-up copy in the one reference
          screenshot available, so "They got it!" is this port's own addition to make the round
          actually scoreable without a second device to auto-detect a spoken guess */}
      <NBPrimaryButton title="They got it! 🎉" onPress={onGotIt} />
      <NBSecondaryButton title={`Done — pass to Player ${drawerIsPlayerOne ? 2 : 1}`} onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: Spacing.three },
  roundRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordCard: { alignItems: 'center', gap: 4 },
  centeredText: { textAlign: 'center' },
  canvas: { width: '100%', aspectRatio: 1, borderRadius: 20, overflow: 'hidden' },
  toolRow: { flexDirection: 'row', gap: Spacing.two },
  toolButton: { flex: 1 },
  resultScreen: { alignItems: 'center', gap: Spacing.two, paddingTop: 60 },
  resultButton: { alignSelf: 'stretch', marginTop: Spacing.three },
});
