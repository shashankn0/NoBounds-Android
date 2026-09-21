import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, PanResponder, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton, NBSecondaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// port of features/play/drawandguessgame.swift — always starts at round 1 with player 1
// drawing, exactly like ios; the two players just agree between themselves who "player 1" is
const WORDS = [
  'House', 'Cat', 'Bicycle', 'Rainbow', 'Pizza', 'Guitar', 'Beach',
  'Airplane', 'Snowman', 'Butterfly', 'Campfire', 'Lighthouse',
  'Ice cream', 'Umbrella', 'Elephant', 'Rocket', 'Castle', 'Penguin',
  'Sunflower', 'Robot', 'Waterfall', 'Hot air balloon', 'Dinosaur',
  'Mermaid', 'Cactus', 'Ferris wheel', 'Octopus', 'Tent', 'Volcano',
  'Sailboat', 'Dragon', 'Picnic', 'Telescope', 'Windmill', 'Igloo',
  'Jellyfish', 'Treehouse', 'Fireworks', 'Koala', 'Submarine',
];

type Point = { x: number; y: number };
type Stroke = Point[];
type Phase = 'wordReveal' | 'drawing' | 'guessing' | 'roundEnd';
type PlayerNumber = 1 | 2;

function shuffledWords(): string[] {
  const arr = [...WORDS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

// committed strokes are memoized so a stroke in progress only re-renders its own polyline,
// not every earlier line on each touch event
const CommittedStrokes = memo(function CommittedStrokes({ strokes, color }: { strokes: Stroke[]; color: string }) {
  return (
    <>
      {strokes.map((stroke, i) => (
        <Polyline
          key={i}
          points={stroke.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </>
  );
});

// ignore jitter smaller than this (dp) so a resting finger doesn't add noise points
const MIN_POINT_DISTANCE = 1.5;

// matches ios's init(): the first word is drawn immediately, before wordReveal even renders
function drawInitial(): { word: string; remaining: string[] } {
  const bag = shuffledWords();
  const word = bag.pop() as string;
  return { word, remaining: bag };
}

export function DrawAndGuess({ onDrawStart, onDrawEnd }: { onDrawStart?: () => void; onDrawEnd?: () => void }) {
  const theme = useTheme();
  const [initial] = useState(drawInitial);
  const remainingWordsRef = useRef<string[]>(initial.remaining);
  // the stroke being drawn lives in a ref and is flushed to state once per frame; it's only
  // committed to `strokes` on release, so undo/clear always see whole strokes
  const activeStrokeRef = useRef<Stroke | null>(null);
  const originRef = useRef<Point>({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const { height: windowHeight } = useWindowDimensions();

  const [phase, setPhase] = useState<Phase>('wordReveal');
  const [drawerNumber, setDrawerNumber] = useState<PlayerNumber>(1);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [word, setWord] = useState<string>(initial.word);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [guessText, setGuessText] = useState('');
  const [lastGuessWrong, setLastGuessWrong] = useState(false);
  const [roundCorrect, setRoundCorrect] = useState(false);

  const guesserNumber: PlayerNumber = drawerNumber === 1 ? 2 : 1;

  function nextWord(): string {
    if (remainingWordsRef.current.length === 0) {
      remainingWordsRef.current = shuffledWords();
    }
    return remainingWordsRef.current.pop() as string;
  }

  function flushActive() {
    frameRef.current = null;
    setActiveStroke(activeStrokeRef.current ? [...activeStrokeRef.current] : null);
  }

  function scheduleFlush() {
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(flushActive);
  }

  function endStroke() {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const finished = activeStrokeRef.current;
    activeStrokeRef.current = null;
    setActiveStroke(null);
    if (finished && finished.length > 0) setStrokes((prev) => [...prev, finished]);
  }

  const panResponder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- refs are only read/written from real touch events, never during render
      PanResponder.create({
        onStartShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 1,
        onMoveShouldSetPanResponder: () => false,
        // never give the gesture up mid-stroke to a parent (scroll view, sheet, tab pager)
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (evt) => {
          // points are origin + gesture offset, not per-event locationX/Y, which on android is
          // relative to whichever child view got hit and can jump between events
          const { locationX, locationY } = evt.nativeEvent;
          originRef.current = { x: locationX, y: locationY };
          activeStrokeRef.current = [{ x: locationX, y: locationY }];
          scheduleFlush();
        },
        onPanResponderMove: (_evt, gesture) => {
          const stroke = activeStrokeRef.current;
          // a second finger (palm, thumb) skews dx/dy into an average of both — skip those moves
          if (!stroke || gesture.numberActiveTouches !== 1) return;
          const point = { x: originRef.current.x + gesture.dx, y: originRef.current.y + gesture.dy };
          const last = stroke[stroke.length - 1];
          if (Math.hypot(point.x - last.x, point.y - last.y) < MIN_POINT_DISTANCE) return;
          stroke.push(point);
          scheduleFlush();
        },
        onPanResponderRelease: endStroke,
        onPanResponderTerminate: endStroke,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers only touch refs and stable state setters
    []
  );

  // lock the enclosing scroll view for the whole drawing phase (set before any touch begins)
  // rather than per stroke, so there's no window where a scroll can steal the first touch
  useEffect(() => {
    if (phase !== 'drawing') return;
    onDrawStart?.();
    return () => onDrawEnd?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDrawStart/onDrawEnd are stable callbacks from the parent
  }, [phase]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    []
  );

  function onUndo() {
    setStrokes((prev) => prev.slice(0, -1));
  }

  function onClear() {
    setStrokes([]);
  }

  function onRevealWord() {
    setPhase('drawing');
  }

  function onPassToGuesser() {
    if (strokes.length === 0) return;
    setLastGuessWrong(false);
    setGuessText('');
    setPhase('guessing');
  }

  function onSubmitGuess() {
    const guess = normalize(guessText);
    if (!guess) return;
    if (guess === normalize(word)) {
      setScore((s) => s + 1);
      setRoundCorrect(true);
      setPhase('roundEnd');
    } else {
      setLastGuessWrong(true);
    }
    setGuessText('');
  }

  function onGiveUp() {
    setRoundCorrect(false);
    setPhase('roundEnd');
  }

  function onNextRound() {
    setRound((r) => r + 1);
    setDrawerNumber(guesserNumber);
    setStrokes([]);
    setGuessText('');
    setLastGuessWrong(false);
    setWord(nextWord());
    setPhase('wordReveal');
  }

  function drawingCanvas(interactive: boolean) {
    return (
      <View
        style={[styles.canvas, { maxHeight: windowHeight * 0.42, backgroundColor: theme.surface, borderColor: theme.border }]}
        {...(interactive ? panResponder.panHandlers : null)}>
        {/* pointerEvents="none" keeps every touch resolving to this outer View instead of a
            polyline underneath it */}
        <Svg width="100%" height="100%" pointerEvents="none">
          <CommittedStrokes strokes={strokes} color={theme.textPrimary} />
          {activeStroke ? (
            <Polyline
              points={activeStroke.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={theme.textPrimary}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
      </View>
    );
  }

  if (phase === 'roundEnd') {
    return (
      <View style={styles.resultScreen}>
        <Ionicons name={roundCorrect ? 'checkmark-circle' : 'bulb'} size={44} color={theme.accent} />
        <ThemedText type="title" style={styles.centeredText}>
          {roundCorrect ? 'Got it!' : 'So close!'}
        </ThemedText>
        <ThemedText type="default" style={styles.centeredText}>
          The word was &ldquo;{word}&rdquo;.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
          {score} guessed right in {round} round{round === 1 ? '' : 's'}.
        </ThemedText>
        <View style={styles.resultButton}>
          <NBPrimaryButton title={`Next round — Player ${guesserNumber} draws`} onPress={onNextRound} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.roundRow}>
        <ThemedText type="smallBold">Round {round}</ThemedText>
        <ThemedText type="smallBold" themeColor="accent">
          Guessed: {score}
        </ThemedText>
      </View>

      {phase === 'wordReveal' ? (
        <NBCard style={styles.centerCard}>
          <Ionicons name="eye-off" size={36} color={theme.accent} />
          <ThemedText type="title" style={styles.centeredText}>
            Player {drawerNumber}, you&apos;re drawing!
          </ThemedText>
          <ThemedText type="default" style={styles.centeredText}>
            Make sure Player {guesserNumber} isn&apos;t looking, then reveal your secret word.
          </ThemedText>
          <View style={styles.centerButton}>
            <NBPrimaryButton title="Reveal my word" onPress={onRevealWord} />
          </View>
        </NBCard>
      ) : phase === 'drawing' ? (
        <>
          <NBCard style={styles.wordCard}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              Draw this — don&apos;t say it out loud!
            </ThemedText>
            <ThemedText type="title" themeColor="accent" style={styles.centeredText}>
              {word}
            </ThemedText>
          </NBCard>

          {drawingCanvas(true)}

          <View style={styles.toolRow}>
            <View style={styles.toolButton}>
              <NBSecondaryButton title="Undo" onPress={onUndo} disabled={strokes.length === 0} compact />
            </View>
            <View style={styles.toolButton}>
              <NBSecondaryButton title="Clear" onPress={onClear} disabled={strokes.length === 0} compact />
            </View>
          </View>

          <NBPrimaryButton title={`Done — pass to Player ${guesserNumber}`} onPress={onPassToGuesser} disabled={strokes.length === 0} />
        </>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            Player {guesserNumber}, what did Player {drawerNumber} draw?
          </ThemedText>

          {drawingCanvas(false)}

          {lastGuessWrong ? (
            <ThemedText type="small" themeColor="destructive" style={styles.centeredText}>
              Not quite — try again!
            </ThemedText>
          ) : null}

          <View style={styles.guessRow}>
            <TextInput
              placeholder="Your guess"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              value={guessText}
              onChangeText={setGuessText}
              onSubmitEditing={onSubmitGuess}
              style={[styles.guessInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
            />
            <Pressable onPress={onSubmitGuess} disabled={guessText.trim().length === 0} hitSlop={8}>
              <Ionicons
                name="arrow-up-circle"
                size={32}
                color={guessText.trim().length === 0 ? theme.textSecondary : theme.accent}
              />
            </Pressable>
          </View>

          <NBSecondaryButton title="Give up — show the word" onPress={onGiveUp} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: Spacing.two },
  roundRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordCard: { alignItems: 'center', gap: 4 },
  centerCard: { alignItems: 'center', gap: 10, paddingVertical: 18 },
  centeredText: { textAlign: 'center' },
  centerButton: { alignSelf: 'stretch', marginTop: 4 },
  canvas: { width: '100%', aspectRatio: 1, alignSelf: 'center', borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  toolRow: { flexDirection: 'row', gap: Spacing.two },
  toolButton: { flex: 1 },
  guessRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  guessInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  resultScreen: { alignItems: 'center', gap: Spacing.two, paddingTop: 60 },
  resultButton: { alignSelf: 'stretch', marginTop: Spacing.three },
});
