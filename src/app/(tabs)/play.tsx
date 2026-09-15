import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DrawAndGuess } from '@/components/draw-and-guess';
import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton, NBSecondaryButton } from '@/components/nb-button';
import { FormHeader } from '@/components/form-header';
import { PetPreviewRow } from '@/components/pet-preview-row';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import type { FlashcardCard, FlashcardLanguage, FlashcardMastery, PetMessage, UserPet } from '@/lib/database-types';
import { errorMessage } from '@/lib/supabase';
import { fetchCards, fetchDecks, fetchProgress, updateCardProgress } from '@/lib/flashcards';
import { mockGames } from '@/lib/mock/play';
import { fetchPetMessages, fetchPets, petMood, sendPetMessage } from '@/lib/pets';

// messages stay visible as a speech bubble for 12h — matches petmodels.swift's displaywindow
const MESSAGE_DISPLAY_WINDOW_MS = 12 * 60 * 60 * 1000;

type Board = (null | 'X' | 'O')[];

const BOARD_GAP = 11;

// rows, then columns, then the two diagonals
const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

// returns the winner along with the line that won, so the board can highlight it
function findWin(board: Board): { player: 'X' | 'O'; line: number[] } | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { player: board[a] as 'X' | 'O', line };
    }
  }
  return null;
}

// fully local, no backend — real multiplayer would need a shared game-state table
function TicTacToe() {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [turn, setTurn] = useState<'X' | 'O'>('X');

  const win = findWin(board);
  const isDraw = !win && board.every((cell) => cell !== null);
  const status = win ? `${win.player} wins!` : isDraw ? "It's a draw!" : `${turn}'s turn`;

  const boardWidth = Math.min(screenWidth - 72, 300);
  const cellSize = (boardWidth - BOARD_GAP * 2) / 3;

  function play(index: number) {
    // occupied cells and finished games both ignore taps
    if (board[index] || win || isDraw) return;
    const next = [...board];
    next[index] = turn;
    setBoard(next);
    setTurn(turn === 'X' ? 'O' : 'X');
  }

  function newGame() {
    setBoard(Array(9).fill(null));
    setTurn('X');
  }

  return (
    <View style={styles.tttScreen}>
      <ThemedText type="title" style={styles.tttStatus}>
        {status}
      </ThemedText>

      <View style={[styles.tttBoard, { width: boardWidth }]}>
        {board.map((cell, index) => {
          const isWinning = win?.line.includes(index) ?? false;
          return (
            <Pressable
              key={index}
              onPress={() => play(index)}
              style={[
                styles.tttCell,
                {
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: theme.surface,
                  borderColor: isWinning ? theme.accent : theme.border,
                  borderWidth: isWinning ? 2 : 1,
                },
              ]}>
              {cell ? (
                <ThemedText style={[styles.tttMark, { color: cell === 'X' ? theme.accent : theme.textSecondary }]}>
                  {cell}
                </ThemedText>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.tttButton, { width: boardWidth }]}>
        <NBSecondaryButton title="New game" onPress={newGame} />
      </View>
    </View>
  );
}

type FlashcardStudyFocus = 'all' | 'practice' | 'starred' | 'fresh';

const FOCUS_OPTIONS: { id: FlashcardStudyFocus; title: string }[] = [
  { id: 'all', title: 'Study all' },
  { id: 'practice', title: 'Practice' },
  { id: 'starred', title: 'Starred' },
  { id: 'fresh', title: 'New cards' },
];

const MASTERY_LABEL: Record<FlashcardMastery, string> = { new: 'New', practice: 'Practice', solid: 'Solid' };

type CardProgress = { mastery: FlashcardMastery; isStarred: boolean; reviewCount: number };
type ProgressMap = Record<string, CardProgress>;
const DEFAULT_CARD_PROGRESS: CardProgress = { mastery: 'new', isStarred: false, reviewCount: 0 };
const STAR_COLOR = '#E0B400';

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function summarize(cards: FlashcardCard[], progress: ProgressMap) {
  let newCount = 0;
  let practiceCount = 0;
  let solidCount = 0;
  let starredCount = 0;
  for (const card of cards) {
    const p = progress[card.id] ?? DEFAULT_CARD_PROGRESS;
    if (p.mastery === 'new') newCount += 1;
    else if (p.mastery === 'practice') practiceCount += 1;
    else solidCount += 1;
    if (p.isStarred) starredCount += 1;
  }
  const total = newCount + practiceCount + solidCount;
  return { newCount, practiceCount, solidCount, starredCount, masteryPercent: total > 0 ? Math.round((solidCount / total) * 100) : 0 };
}

// mirrors ios's FlashcardStudySession.buildQueue(): cards needing more practice are weighted to
// come up more often, then any single card is capped at 2 appearances so the round stays varied
function buildQueue(cards: FlashcardCard[], progress: ProgressMap, focus: FlashcardStudyFocus): number[] {
  const progressFor = (i: number) => progress[cards[i].id] ?? DEFAULT_CARD_PROGRESS;

  const candidates = cards.map((_, i) => i).filter((i) => {
    const p = progressFor(i);
    if (focus === 'all') return p.mastery !== 'solid';
    if (focus === 'practice') return p.mastery === 'practice';
    if (focus === 'starred') return p.isStarred;
    return p.mastery === 'new';
  });

  const weighted: number[] = [];
  for (const i of candidates) {
    const p = progressFor(i);
    let weight = 1;
    if (p.mastery === 'practice') weight += 2;
    if (p.isStarred) weight += 1;
    if (p.mastery === 'new') weight += 1;
    for (let w = 0; w < weight; w++) weighted.push(i);
  }

  const seenCount: Record<number, number> = {};
  const queue = shuffled(weighted).filter((i) => {
    const count = seenCount[i] ?? 0;
    if (count >= 2) return false;
    seenCount[i] = count + 1;
    return true;
  });

  if (queue.length === 0 && focus === 'all') {
    // nothing left to learn — a light recap of starred cards instead of an empty round
    return shuffled(cards.map((_, i) => i).filter((i) => progressFor(i).isStarred));
  }
  return queue.length > 0 ? queue : shuffled(candidates);
}

function Flashcards({ language, title }: { language: FlashcardLanguage; title: string }) {
  const theme = useTheme();
  const [cards, setCards] = useState<FlashcardCard[]>([]);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [queue, setQueue] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [focus, setFocus] = useState<FlashcardStudyFocus>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewedThisRound, setReviewedThisRound] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const decks = await fetchDecks(language);
      const deck = decks[0];
      if (!deck) throw new Error('No flashcard deck is available for this language.');

      const [deckCards, progressRows] = await Promise.all([fetchCards(deck.id), fetchProgress()]);
      const map: ProgressMap = {};
      for (const row of progressRows) {
        map[row.card_id] = { mastery: row.mastery, isStarred: row.is_starred, reviewCount: row.review_count };
      }

      setCards(deckCards);
      setProgress(map);
      const nextQueue = buildQueue(deckCards, map, focus);
      setQueue(nextQueue);
      setCurrentIndex(0);
      setIsFlipped(false);
      setReviewedThisRound(0);
      setSessionComplete(nextQueue.length === 0);
    } catch (err) {
      setError(errorMessage(err, 'Could not load flashcards'));
    } finally {
      setLoading(false);
    }
    // focus is deliberately excluded: switching the focus picker rebuilds locally (applyFocus)
    // rather than refetching, so this should only re-run when the language actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // local-first rebuild, no network round-trip — matches ios's applyFocus/restartSession
  function restart(nextFocus: FlashcardStudyFocus, cardsArg: FlashcardCard[] = cards, progressArg: ProgressMap = progress) {
    setFocus(nextFocus);
    const nextQueue = buildQueue(cardsArg, progressArg, nextFocus);
    setQueue(nextQueue);
    setCurrentIndex(0);
    setIsFlipped(false);
    setReviewedThisRound(0);
    setSessionComplete(nextQueue.length === 0);
  }

  function advance(latestProgress: ProgressMap) {
    setReviewedThisRound((n) => n + 1);
    setIsFlipped(false);

    if (currentIndex + 1 >= queue.length) {
      const summary = summarize(cards, latestProgress);
      if (focus === 'all' && summary.practiceCount > 0) {
        const nextQueue = buildQueue(cards, latestProgress, focus);
        setQueue(nextQueue);
        setCurrentIndex(0);
        setSessionComplete(nextQueue.length === 0);
      } else {
        setSessionComplete(true);
      }
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  function mark(card: FlashcardCard, mastery: FlashcardMastery) {
    const current = progress[card.id] ?? DEFAULT_CARD_PROGRESS;
    const next: CardProgress = { mastery, isStarred: current.isStarred, reviewCount: current.reviewCount + 1 };
    const nextProgress = { ...progress, [card.id]: next };
    setProgress(nextProgress);
    updateCardProgress(card.id, next.mastery, next.isStarred, next.reviewCount).catch(() => {});
    advance(nextProgress);
  }

  function toggleStar(card: FlashcardCard) {
    const current = progress[card.id] ?? DEFAULT_CARD_PROGRESS;
    const next: CardProgress = { ...current, isStarred: !current.isStarred };
    const nextProgress = { ...progress, [card.id]: next };
    setProgress(nextProgress);
    updateCardProgress(card.id, next.mastery, next.isStarred, next.reviewCount).catch(() => {});
  }

  if (loading) {
    return (
      <ThemedText type="default" themeColor="textSecondary">
        Loading…
      </ThemedText>
    );
  }

  if (error) {
    return (
      <View style={styles.flashcardCenter}>
        <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
          {error}
        </ThemedText>
        <NBSecondaryButton title="Try again" onPress={load} />
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={styles.flashcardCenter}>
        <ThemedText type="default" themeColor="textSecondary">
          This deck has no cards yet.
        </ThemedText>
      </View>
    );
  }

  const summary = summarize(cards, progress);

  if (sessionComplete) {
    return (
      <View style={styles.flashcardCenter}>
        <Ionicons name="sparkles" size={44} color={theme.accent} />
        <ThemedText type="title" style={styles.centeredText}>
          Round complete!
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
          You reviewed {reviewedThisRound} cards. {summary.masteryPercent}% of the deck is solid.
        </ThemedText>
        {summary.practiceCount > 0 ? (
          <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
            {summary.practiceCount} cards still need practice — keep going!
          </ThemedText>
        ) : null}
        <View style={styles.sessionCompleteButtons}>
          <NBPrimaryButton title="Study again" onPress={() => restart(focus)} />
          <NBSecondaryButton title="Practice weak cards" onPress={() => restart('practice')} disabled={summary.practiceCount === 0} />
        </View>
      </View>
    );
  }

  const card = cards[queue[currentIndex]];
  if (!card) {
    return (
      <View style={styles.flashcardCenter}>
        <ThemedText type="default" themeColor="textSecondary">
          No cards match this study focus.
        </ThemedText>
      </View>
    );
  }

  const cardProgress = progress[card.id] ?? DEFAULT_CARD_PROGRESS;
  const masteryColor =
    cardProgress.mastery === 'solid' ? theme.accent : cardProgress.mastery === 'practice' ? theme.destructive : theme.textSecondary;

  return (
    <View style={styles.flashcardScreen}>
      <View style={styles.progressChipsRow}>
        <ProgressChip count={summary.solidCount} label="Solid" color={theme.accent} />
        <ProgressChip count={summary.practiceCount} label="Practice" color={theme.destructive} />
        <ProgressChip count={summary.starredCount} label="Starred" color={STAR_COLOR} />
        <ProgressChip count={summary.newCount} label="New" color={theme.textSecondary} />
      </View>
      <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.progressFill, { width: `${summary.masteryPercent}%`, backgroundColor: theme.accent }]} />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
        {summary.masteryPercent}% mastered · {reviewedThisRound} reviewed this round
      </ThemedText>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.focusRow}>
        {FOCUS_OPTIONS.map((option) => {
          const active = option.id === focus;
          return (
            <Pressable
              key={option.id}
              onPress={() => restart(option.id)}
              style={[
                styles.focusChip,
                { borderColor: active ? theme.accent : theme.border, backgroundColor: active ? theme.accentMuted : theme.surface },
              ]}>
              <ThemedText type="smallBold" style={{ color: active ? theme.accent : theme.textSecondary }}>
                {option.title}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable onPress={() => setIsFlipped(!isFlipped)} style={[styles.flashcardFace, { backgroundColor: theme.surface }]}>
        <Pressable onPress={() => toggleStar(card)} hitSlop={8} style={[styles.starButton, { backgroundColor: theme.background }]}>
          <Ionicons name={cardProgress.isStarred ? 'star' : 'star-outline'} size={20} color={cardProgress.isStarred ? STAR_COLOR : theme.textSecondary} />
        </Pressable>
        <ThemedText type="title" style={styles.centeredText}>
          {isFlipped ? card.back_text : card.front_text}
        </ThemedText>
        {isFlipped ? (
          <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
            English
          </ThemedText>
        ) : card.reading_text ? (
          <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
            {card.reading_text}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
          {isFlipped ? 'How well did you know it?' : 'Tap to flip'}
        </ThemedText>
      </Pressable>

      <View style={styles.statusBadgeRow}>
        <View style={[styles.masteryBadge, { backgroundColor: masteryColor + '26' }]}>
          <ThemedText type="smallBold" style={{ color: masteryColor }}>
            {MASTERY_LABEL[cardProgress.mastery]}
          </ThemedText>
        </View>
        {cardProgress.isStarred ? (
          <View style={styles.starredLabel}>
            <Ionicons name="star" size={13} color={STAR_COLOR} />
            <ThemedText type="smallBold" style={{ color: STAR_COLOR }}>
              Starred
            </ThemedText>
          </View>
        ) : null}
        {cardProgress.reviewCount > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Seen {cardProgress.reviewCount}×
          </ThemedText>
        ) : null}
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
        {currentIndex + 1} of {queue.length} in queue
      </ThemedText>

      {isFlipped ? (
        <View style={styles.ratingRow}>
          <Pressable style={[styles.ratingButton, { backgroundColor: theme.surface }]} onPress={() => mark(card, 'practice')}>
            <Ionicons name="arrow-undo-circle" size={26} color={theme.destructive} />
            <ThemedText type="smallBold" style={styles.centeredText}>
              Still learning
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              Show again soon
            </ThemedText>
          </Pressable>
          <Pressable style={[styles.ratingButton, { backgroundColor: theme.surface }]} onPress={() => mark(card, 'solid')}>
            <Ionicons name="checkmark-circle" size={26} color={theme.accent} />
            <ThemedText type="smallBold" style={styles.centeredText}>
              Got it!
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              Mark as solid
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
          Flip the card, then rate how well you know it
        </ThemedText>
      )}
    </View>
  );
}

function ProgressChip({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <View style={styles.progressChip}>
      <ThemedText type="smallBold" style={{ color }}>
        {count}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

export default function PlayScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, couple } = useSession();
  const [activeGame, setActiveGame] = useState<(typeof mockGames)[number]['id'] | null>(null);
  const [pets, setPets] = useState<UserPet[]>([]);
  // sender_user_id -> text, precomputed at fetch time (not render time) so the 12h window
  // check only ever calls Date.now() from an event handler, never from the render body
  const [visibleMessages, setVisibleMessages] = useState<Record<string, string>>({});
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const loadPetArea = useCallback(() => {
    if (!couple) return;
    fetchPets(couple.id)
      .then(setPets)
      .catch(() => {});
    fetchPetMessages(couple.id)
      .then((messages: PetMessage[]) => {
        const now = Date.now();
        const bySender: Record<string, string> = {};
        for (const message of messages) {
          if (bySender[message.sender_user_id]) continue;
          if (now - new Date(message.created_at).getTime() > MESSAGE_DISPLAY_WINDOW_MS) continue;
          bySender[message.sender_user_id] = message.text;
        }
        setVisibleMessages(bySender);
      })
      .catch(() => {});
  }, [couple]);

  useFocusEffect(
    useCallback(() => {
      loadPetArea();
    }, [loadPetArea])
  );

  const myPet = pets.find((p) => p.user_id === session?.user.id) ?? null;
  const partnerPet = pets.find((p) => p.user_id !== session?.user.id) ?? null;

  function latestMessageFrom(userId: string | undefined): string | null {
    if (!userId) return null;
    return visibleMessages[userId] ?? null;
  }

  async function onSendMessage() {
    if (!couple || messageText.trim().length === 0) return;
    setSending(true);
    try {
      await sendPetMessage(couple.id, messageText.trim().slice(0, 80));
      setMessageText('');
      loadPetArea();
    } catch {
      // best-effort — the composer just keeps whatever text was typed on failure
    } finally {
      setSending(false);
    }
  }

  // simple in-screen router: showing a game swaps the whole body, no nested navigation
  if (activeGame) {
    return (
      <ThemedView style={{ flex: 1 }}>
        {/* ios gives each game its own screen: back button + the game's name, centered */}
        <FormHeader
          title={mockGames.find((game) => game.id === activeGame)?.title ?? 'Games'}
          leftIcon="chevron-back"
          onLeftPress={() => setActiveGame(null)}
        />
        <View style={[styles.container, { paddingBottom: insets.bottom + BottomTabInset }]}>
          {activeGame === 'tic-tac-toe' ? <TicTacToe /> : null}
          {activeGame === 'spanish-flashcards' ? <Flashcards language="spanish" title="Spanish Flashcards" /> : null}
          {activeGame === 'japanese-flashcards' ? <Flashcards language="japanese" title="Japanese Flashcards" /> : null}
          {activeGame === 'draw-and-guess' ? (
            couple ? (
              <DrawAndGuess coupleId={couple.id} />
            ) : (
              <NBCard style={styles.gameCard}>
                <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
                  Draw &amp; Guess needs a partner — connect with one first.
                </ThemedText>
              </NBCard>
            )
          ) : null}
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScreenHeader showPairing />
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
          <>
            <NBCard>
              <Pressable onPress={() => router.push(myPet ? { pathname: '/pet', params: { petId: myPet.id } } : '/pet')}>
                <PetPreviewRow myPet={myPet} partnerPet={partnerPet} />
              </Pressable>
              {latestMessageFrom(myPet?.user_id) ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.messageBubble}>
                  You: {latestMessageFrom(myPet?.user_id)}
                </ThemedText>
              ) : null}
              {latestMessageFrom(partnerPet?.user_id) ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.messageBubble}>
                  Partner: {latestMessageFrom(partnerPet?.user_id)}
                </ThemedText>
              ) : null}
              {!myPet ? (
                <View style={styles.body}>
                  <NBPrimaryButton title="Choose your pet" onPress={() => router.push('/pet')} />
                </View>
              ) : null}
            </NBCard>

            <NBCard>
              <View style={styles.composerRow}>
                <TextInput
                  placeholder="Say something to your partner…"
                  placeholderTextColor={theme.textSecondary}
                  value={messageText}
                  onChangeText={(t) => setMessageText(t.slice(0, 80))}
                  style={[styles.composerInput, { color: theme.textPrimary }]}
                />
                <Pressable onPress={onSendMessage} disabled={sending || messageText.trim().length === 0} hitSlop={8}>
                  <Ionicons
                    name="arrow-up-circle"
                    size={30}
                    color={messageText.trim().length === 0 ? theme.textSecondary : theme.accent}
                  />
                </Pressable>
              </View>
            </NBCard>

            {myPet || partnerPet ? (
              <NBCard style={styles.rowsCard}>
                {[myPet, partnerPet].map((pet, index) =>
                  pet ? (
                    <Pressable
                      key={pet.id}
                      onPress={() => router.push({ pathname: '/pet', params: { petId: pet.id } })}
                      style={[styles.petRow, index === 0 && !!partnerPet && { borderBottomWidth: 1, borderColor: theme.separator }]}>
                      <View style={styles.petRowText}>
                        <ThemedText type="smallBold">{pet.name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                          {pet.bio ?? 'No bio yet — tap to add one.'}
                        </ThemedText>
                      </View>
                      <View style={styles.petMeters}>
                        <Ionicons name="restaurant" size={14} color={theme.textSecondary} />
                        <MiniMeter value={petMood(pet).fullness} theme={theme} />
                        <Ionicons name="heart" size={14} color={theme.accent} style={styles.meterGap} />
                        <MiniMeter value={petMood(pet).happiness} theme={theme} />
                      </View>
                    </Pressable>
                  ) : null
                )}
              </NBCard>
            ) : null}
          </>
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

function MiniMeter({ value, theme }: { value: number; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={[styles.miniMeterTrack, { backgroundColor: theme.border }]}>
      <View style={[styles.miniMeterFill, { width: `${Math.max(4, value * 100)}%`, backgroundColor: theme.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  centered: { alignItems: 'center', gap: 4 },
  body: { marginTop: 12 },
  messageBubble: { marginTop: 10 },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  composerInput: { flex: 1, fontSize: 15, paddingVertical: 4 },
  rowsCard: { paddingVertical: 4 },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  petRowText: { flex: 1, gap: 2 },
  petMeters: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meterGap: { marginLeft: 6 },
  miniMeterTrack: { width: 36, height: 6, borderRadius: 3, overflow: 'hidden' },
  miniMeterFill: { height: '100%', borderRadius: 3 },
  centeredText: { textAlign: 'center' },
  emptyIcon: { fontSize: 40 },
  cardBody: { marginTop: 8 },
  cardButton: { marginTop: 12 },
  sectionHeading: { marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '47%' },
  gridCard: { gap: 6, minHeight: 110 },
  gridCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  gameCard: { alignItems: 'center', gap: 12 },
  tttScreen: { alignItems: 'center', gap: 28, paddingTop: 40 },
  tttStatus: { textAlign: 'center' },
  tttBoard: { flexDirection: 'row', flexWrap: 'wrap', gap: BOARD_GAP },
  tttCell: { borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tttMark: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  tttButton: { marginTop: 4 },
  flashcardCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 40 },
  sessionCompleteButtons: { alignSelf: 'stretch', gap: 10, marginTop: 8 },
  flashcardScreen: { gap: 12 },
  progressChipsRow: { flexDirection: 'row' },
  progressChip: { flex: 1, alignItems: 'center', gap: 2 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  focusRow: { gap: 8, paddingRight: 8 },
  focusChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  flashcardFace: {
    minHeight: 220,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  starButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  masteryBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  starredLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingRow: { flexDirection: 'row', gap: 12 },
  ratingButton: { flex: 1, alignItems: 'center', gap: 4, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 8 },
});
