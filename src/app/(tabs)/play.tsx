import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { mockFlashcardDecks, mockGames } from '@/lib/mock/play';
import { mockPet, petMoodEmoji } from '@/lib/mock/pet';

type Board = (null | 'X' | 'O')[];

function TicTacToe() {
  const theme = useTheme();
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [turn, setTurn] = useState<'X' | 'O'>('X');

  function play(index: number) {
    if (board[index]) return;
    const next = [...board];
    next[index] = turn;
    setBoard(next);
    setTurn(turn === 'X' ? 'O' : 'X');
  }

  return (
    <NBCard style={styles.gameCard}>
      <ThemedText type="smallBold">Tic-Tac-Toe — {turn}&apos;s turn</ThemedText>
      <View style={styles.board}>
        {board.map((cell, index) => (
          <Pressable key={index} style={[styles.cell, { borderColor: theme.border }]} onPress={() => play(index)}>
            <ThemedText type="title">{cell ?? ''}</ThemedText>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => setBoard(Array(9).fill(null))}>
        <ThemedText type="link" themeColor="accent">
          Reset
        </ThemedText>
      </Pressable>
    </NBCard>
  );
}

function Flashcards({ deckId }: { deckId: 'spanish' | 'japanese' }) {
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const deck = mockFlashcardDecks[deckId];
  const card = deck[index];

  return (
    <NBCard style={styles.gameCard}>
      <ThemedText type="smallBold">{deckId === 'spanish' ? 'Spanish Flashcards' : 'Japanese Flashcards'}</ThemedText>
      <Pressable onPress={() => setShowBack(!showBack)}>
        <ThemedText type="title" style={styles.flashcardText}>
          {showBack ? card.back : card.front}
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={() => {
          setShowBack(false);
          setIndex((index + 1) % deck.length);
        }}>
        <ThemedText type="link" themeColor="accent">
          Next card
        </ThemedText>
      </Pressable>
    </NBCard>
  );
}

export default function PlayScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { couple } = useSession();
  const [activeGame, setActiveGame] = useState<(typeof mockGames)[number]['id'] | null>(null);

  if (activeGame) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <ScreenHeader />
        <View style={[styles.container, { paddingBottom: insets.bottom + BottomTabInset }]}>
          <Pressable onPress={() => setActiveGame(null)} style={styles.backRow}>
            <Ionicons name="chevron-back" size={18} color={theme.accent} />
            <ThemedText type="link" themeColor="accent">
              Games
            </ThemedText>
          </Pressable>
          {activeGame === 'tic-tac-toe' ? <TicTacToe /> : null}
          {activeGame === 'spanish-flashcards' ? <Flashcards deckId="spanish" /> : null}
          {activeGame === 'japanese-flashcards' ? <Flashcards deckId="japanese" /> : null}
          {activeGame === 'draw-and-guess' ? (
            <NBCard style={styles.gameCard}>
              <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
                Draw &amp; Guess needs a live connection between both partners — not wired up in this
                prototype yet.
              </ThemedText>
            </NBCard>
          ) : null}
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScreenHeader centerLabel={couple ? 'Paired with Partner 💛' : undefined} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + BottomTabInset }]}>
        {!couple ? (
          <>
            <NBCard>
              <ThemedText type="title">Pets unlock when you pair</ThemedText>
              <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
                Connect with your partner to adopt a companion and share a play area together.
              </ThemedText>
              <View style={styles.cardButton}>
                <NBPrimaryButton title="Set up pairing" onPress={() => router.push('/pairing')} />
              </View>
            </NBCard>

            <NBCard>
              <ThemedText type="title">Shared play area</ThemedText>
              <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
                Each of you chooses and names one pet. Both companions wander together in a cozy space on
                this tab.
              </ThemedText>
            </NBCard>
          </>
        ) : (
          <NBCard style={styles.centered}>
            <ThemedText style={styles.emptyIcon}>{petMoodEmoji[mockPet.mood]}</ThemedText>
            <ThemedText type="smallBold">{mockPet.name} is wandering the play area</ThemedText>
            <Pressable onPress={() => router.push('/pet')}>
              <ThemedText type="link" themeColor="accent">
                Visit pet
              </ThemedText>
            </Pressable>
          </NBCard>
        )}

        <ThemedText type="subtitle" style={styles.sectionHeading}>
          Games
        </ThemedText>
        <View style={styles.grid}>
          {mockGames.map((game) => (
            <Pressable key={game.id} onPress={() => setActiveGame(game.id)} style={styles.gridItem}>
              <NBCard style={styles.gridCard}>
                <View style={styles.gridCardTop}>
                  <Ionicons name={game.icon} size={22} color={theme.accent} />
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </View>
                <ThemedText type="smallBold">{game.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {game.subtitle}
                </ThemedText>
              </NBCard>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  centered: { alignItems: 'center', gap: 4 },
  centeredText: { textAlign: 'center' },
  emptyIcon: { fontSize: 40 },
  cardBody: { marginTop: 8 },
  cardButton: { marginTop: 12 },
  sectionHeading: { marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '47%' },
  gridCard: { gap: 6, minHeight: 110 },
  gridCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  gameCard: { alignItems: 'center', gap: 12 },
  board: { flexDirection: 'row', flexWrap: 'wrap', width: 210 },
  cell: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  flashcardText: { paddingVertical: 24 },
});
