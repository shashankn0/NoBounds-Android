import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton, NBSecondaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

// no table for this on the real backend, and we're not allowed to add one — a realtime
// broadcast channel gives a genuinely live connection between both partners without
// persisting anything to the database at all
const WORDS = ['pizza', 'guitar', 'umbrella', 'castle', 'rainbow', 'robot', 'volcano', 'penguin', 'bicycle', 'lighthouse'];

type Point = { x: number; y: number };
type Stroke = Point[];
type Guess = { text: string; correct: boolean };

export function DrawAndGuess({ coupleId }: { coupleId: string }) {
  const theme = useTheme();
  const channel = useMemo(() => supabase.channel(`draw-and-guess:${coupleId}`), [coupleId]);
  const [role, setRole] = useState<'drawer' | 'guesser' | null>(null);
  const [word, setWord] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [guessDraft, setGuessDraft] = useState('');
  const [guesses, setGuesses] = useState<Guess[]>([]);

  // panresponder callbacks are created exactly once below, so they'd otherwise close over
  // stale state forever — refs stay current across renders without that problem
  const roleRef = useRef(role);
  useEffect(() => {
    roleRef.current = role;
  }, [role]);
  const strokeCountRef = useRef(0);

  useEffect(() => {
    channel
      .on('broadcast', { event: 'point' }, ({ payload }) => {
        setStrokes((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && payload.strokeIndex === next.length - 1) {
            next[next.length - 1] = [...last, { x: payload.x, y: payload.y }];
          } else {
            next.push([{ x: payload.x, y: payload.y }]);
          }
          return next;
        });
      })
      .on('broadcast', { event: 'clear' }, () => {
        setStrokes([]);
        setGuesses([]);
      })
      .on('broadcast', { event: 'guess' }, ({ payload }) => {
        // only the drawer's client knows the word, so only it judges correctness
        setWord((currentWord) => {
          if (currentWord) {
            const correct = payload.text.trim().toLowerCase() === currentWord.toLowerCase();
            channel.send({ type: 'broadcast', event: 'guess-result', payload: { text: payload.text, correct } });
          }
          return currentWord;
        });
      })
      .on('broadcast', { event: 'guess-result' }, ({ payload }) => {
        setGuesses((prev) => [...prev, { text: payload.text, correct: payload.correct }]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channel]);

  function pickRole(next: 'drawer' | 'guesser') {
    setRole(next);
    if (next === 'drawer') {
      setWord(WORDS[Math.floor(Math.random() * WORDS.length)]);
    }
  }

  function onNewWord() {
    setWord(WORDS[Math.floor(Math.random() * WORDS.length)]);
    setStrokes([]);
    setGuesses([]);
    strokeCountRef.current = 0;
    channel.send({ type: 'broadcast', event: 'clear', payload: {} });
  }

  // useMemo (not useRef().current) so panHandlers is a plain memoized value, not a ref read
  // during render — the responder itself still only gets created once, via the [] deps.
  const panResponder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- callbacks below only run from real touch events, never during render
      PanResponder.create({
        onStartShouldSetPanResponder: () => roleRef.current === 'drawer',
        onMoveShouldSetPanResponder: () => roleRef.current === 'drawer',
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const strokeIndex = strokeCountRef.current;
          strokeCountRef.current += 1;
          setStrokes((prev) => [...prev, [{ x: locationX, y: locationY }]]);
          channel.send({ type: 'broadcast', event: 'point', payload: { x: locationX, y: locationY, strokeIndex } });
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const strokeIndex = strokeCountRef.current - 1;
          setStrokes((prev) => {
            const next = [...prev];
            next[strokeIndex] = [...next[strokeIndex], { x: locationX, y: locationY }];
            return next;
          });
          channel.send({ type: 'broadcast', event: 'point', payload: { x: locationX, y: locationY, strokeIndex } });
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally created once
    []
  );

  function onSubmitGuess() {
    if (guessDraft.trim().length === 0) return;
    channel.send({ type: 'broadcast', event: 'guess', payload: { text: guessDraft.trim() } });
    setGuessDraft('');
  }

  if (!role) {
    return (
      <NBCard style={styles.card}>
        <ThemedText type="smallBold">Draw &amp; Guess</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
          One of you draws, the other guesses — live, over a real connection.
        </ThemedText>
        <View style={styles.roleRow}>
          <NBPrimaryButton title="I'll draw" onPress={() => pickRole('drawer')} />
          <NBSecondaryButton title="I'll guess" onPress={() => pickRole('guesser')} />
        </View>
      </NBCard>
    );
  }

  return (
    <NBCard style={styles.card}>
      {role === 'drawer' ? (
        <View style={styles.header}>
          <ThemedText type="smallBold">Draw: {word}</ThemedText>
          <Pressable onPress={onNewWord}>
            <ThemedText type="link" themeColor="accent">
              New word
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <ThemedText type="smallBold">Guess what your partner is drawing</ThemedText>
      )}

      <View style={[styles.canvas, { borderColor: theme.border }]} {...panResponder.panHandlers}>
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

      {role === 'guesser' ? (
        <View style={styles.guessRow}>
          <TextInput
            placeholder="Type your guess"
            placeholderTextColor={theme.textSecondary}
            value={guessDraft}
            onChangeText={setGuessDraft}
            onSubmitEditing={onSubmitGuess}
            style={[styles.guessInput, { color: theme.textPrimary, borderColor: theme.border }]}
          />
          <Pressable onPress={onSubmitGuess}>
            <ThemedText type="link" themeColor="accent">
              Send
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {guesses.length > 0 ? (
        <View style={styles.guessList}>
          {guesses.slice(-4).map((g, i) => (
            <ThemedText key={i} type="small" themeColor={g.correct ? 'accent' : 'textSecondary'}>
              {g.text} {g.correct ? '— correct! 🎉' : ''}
            </ThemedText>
          ))}
        </View>
      ) : null}
    </NBCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  body: { marginBottom: Spacing.two },
  roleRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  canvas: { width: '100%', height: 260, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  guessRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  guessInput: { flex: 1, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  guessList: { gap: 4 },
});
