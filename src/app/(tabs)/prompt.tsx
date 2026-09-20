import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MessageBubble } from '@/components/message-bubble';
import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { PromptDateSeparator } from '@/components/prompt-date-separator';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset } from '@/constants/theme';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { CHAT_PAGE_SIZE, fetchChatPage, fetchWeeklyPrompt, localDateKey, sendMessage, type ChatMessage } from '@/lib/prompts';

// the tab formerly called "Prompt" is now "Chat": one flat, imessage-style stream per couple.
// prompts someone sent show as centered system bubbles; everything else is a normal bubble.
const POLL_INTERVAL_MS = 15_000;

function mergeById(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return Array.from(byId.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, couple } = useSession();
  const scrollRef = useRef<ScrollView>(null);
  const didInitialScrollRef = useRef(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [weekly, setWeekly] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = session?.user.id ?? null;
  const coupleId = couple?.id ?? null;

  const feed = useMemo(() => (weekly ? mergeById(messages, [weekly]) : messages), [messages, weekly]);

  const scrollToEnd = useCallback((animated: boolean) => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated }));
  }, []);

  const loadLatest = useCallback(
    async (mode: 'initial' | 'refresh' | 'poll') => {
      if (!coupleId) {
        setLoading(false);
        return;
      }
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      try {
        const [page, weeklyPrompt] = await Promise.all([
          fetchChatPage(coupleId),
          mode === 'poll' ? Promise.resolve(null) : fetchWeeklyPrompt(coupleId),
        ]);
        if (weeklyPrompt) setWeekly(weeklyPrompt);
        setMessages((prev) => mergeById(prev, page));
        if (mode !== 'poll') setHasMore(page.length === CHAT_PAGE_SIZE);
        setError(null);
      } catch (err) {
        if (mode !== 'poll') setError(err instanceof Error ? err.message : 'Could not load chat');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [coupleId]
  );

  useFocusEffect(
    useCallback(() => {
      loadLatest('initial').then(() => {
        if (!didInitialScrollRef.current) {
          didInitialScrollRef.current = true;
          scrollToEnd(false);
        }
      });
      const id = setInterval(() => loadLatest('poll'), POLL_INTERVAL_MS);
      return () => clearInterval(id);
    }, [loadLatest, scrollToEnd])
  );

  async function loadOlder() {
    if (!coupleId || loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const page = await fetchChatPage(coupleId, messages[0].created_at);
      setMessages((prev) => mergeById(prev, page));
      setHasMore(page.length === CHAT_PAGE_SIZE);
    } catch {
      // best-effort — keep whatever's already loaded
    } finally {
      setLoadingMore(false);
    }
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (e.nativeEvent.contentOffset.y < 40) loadOlder();
  }

  async function onSend() {
    const text = draft.trim();
    if (!text || !coupleId) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage(coupleId, text);
      setDraft('');
      await loadLatest('poll');
      scrollToEnd(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message');
    } finally {
      setSending(false);
    }
  }

  if (!couple) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <ScreenHeader />
        <View style={[styles.container, { paddingBottom: insets.bottom + BottomTabInset }]}>
          <NBCard>
            <ThemedText type="title">Chat</ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.cardBody}>
              Chat and prompts unlock after you connect with your partner.
            </ThemedText>
            <View style={styles.cardButton}>
              <NBPrimaryButton title="Invite your partner" onPress={() => router.push('/pairing')} />
            </View>
          </NBCard>
        </View>
      </ThemedView>
    );
  }

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={() => loadLatest('refresh')} tintColor={theme.accent} />;
  const canSend = draft.trim().length > 0 && !sending;

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScreenHeader />

      {loading && feed.length === 0 ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : feed.length === 0 ? (
        <ScrollView contentContainerStyle={styles.centerFillScroll} refreshControl={refreshControl}>
          <Ionicons name="chatbubbles" size={48} color={theme.accent} />
          <ThemedText type="title" style={styles.centeredText}>
            Your chat
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
            Send a message, or tap + to send your partner a prompt.
          </ThemedText>
        </ScrollView>
      ) : (
        <ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={200}
          refreshControl={refreshControl}
          contentContainerStyle={[styles.feed, { paddingBottom: 12 }]}>
          {loadingMore ? <ActivityIndicator color={theme.accent} style={styles.loadingMore} /> : null}
          {feed.map((message, index) => {
            const dayKey = localDateKey(message.created_at);
            const showDay = index === 0 || localDateKey(feed[index - 1].created_at) !== dayKey;
            return (
              <View key={message.id} style={styles.row}>
                {showDay ? <PromptDateSeparator dateOnly={dayKey} /> : null}
                <ChatRow message={message} isMine={message.user_id === currentUserId} />
              </View>
            );
          })}
        </ScrollView>
      )}

      {error ? (
        <ThemedText type="small" themeColor="destructive" style={styles.errorText}>
          {error}
        </ThemedText>
      ) : null}

      <View style={[styles.composerBar, { paddingBottom: insets.bottom + BottomTabInset, backgroundColor: theme.surface }]}>
        <Pressable
          onPress={() => router.push({ pathname: '/send-prompt', params: { coupleId: couple.id } })}
          style={[styles.composerAddButton, { backgroundColor: theme.accent }]}>
          <Ionicons name="add" size={24} color="#000000" />
        </Pressable>
        <View style={[styles.composerField, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <TextInput
            placeholder="Message"
            placeholderTextColor={theme.textSecondary}
            value={draft}
            onChangeText={setDraft}
            style={[styles.composerInput, { color: theme.textPrimary }]}
          />
        </View>
        <Pressable onPress={onSend} disabled={!canSend} hitSlop={8}>
          <Ionicons name="arrow-up-circle" size={36} color={canSend ? theme.accent : theme.textSecondary} />
        </Pressable>
      </View>
    </ThemedView>
  );
}

function ChatRow({ message, isMine }: { message: ChatMessage; isMine: boolean }) {
  const theme = useTheme();

  if (message.kind === 'prompt') {
    return (
      <View style={styles.promptColumn}>
        <MessageBubble text={message.body} alignment="center" background={theme.bubbleSystem} foreground={theme.bubbleSystemText} />
        {message.isWeekly ? null : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.promptCaption}>
            {isMine ? 'Asked by you' : 'Asked by your partner'}
          </ThemedText>
        )}
      </View>
    );
  }

  const bubble = message.body.trim().length > 0 ? (
    <MessageBubble
      text={message.body}
      alignment={isMine ? 'trailing' : 'leading'}
      background={isMine ? theme.bubbleOutgoing : theme.bubbleIncoming}
      foreground={isMine ? theme.bubbleOutgoingText : theme.bubbleIncomingText}
    />
  ) : null;

  if (message.kind === 'photo_reply' && message.photoUrl) {
    return (
      <View style={[styles.photoColumn, isMine && styles.photoColumnMine]}>
        <Image source={{ uri: message.photoUrl }} style={[styles.photo, { borderColor: theme.border }]} resizeMode="cover" />
        {bubble}
      </View>
    );
  }

  return bubble;
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  cardBody: { marginTop: 8 },
  cardButton: { marginTop: 12 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  centerFillScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  centeredText: { textAlign: 'center' },
  feed: { padding: 12, gap: 6 },
  row: { gap: 6 },
  loadingMore: { paddingVertical: 8 },
  errorText: { paddingHorizontal: 20, paddingBottom: 4 },
  promptColumn: { gap: 4 },
  promptCaption: { textAlign: 'center', fontWeight: '600' },
  photoColumn: { alignItems: 'flex-start', gap: 4 },
  photoColumnMine: { alignItems: 'flex-end' },
  photo: { width: 180, height: 180, borderRadius: 18, borderWidth: 1 },
  composerBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 8 },
  composerAddButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  composerField: { flex: 1, borderRadius: 999, borderWidth: 1, paddingHorizontal: 16 },
  composerInput: { paddingVertical: 10, fontSize: 16 },
});
