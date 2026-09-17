import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { LinearTransition, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import {
  DEFAULT_EXTENSION_ENABLED,
  EXTENSION_IDS,
  loadExtensionEnabled,
  loadExtensionOrder,
  saveExtensionEnabled,
  saveExtensionOrder,
  type ExtensionId,
} from '@/lib/extension-preferences';
import { submitFeedback } from '@/lib/feedback';

type ExtensionRow = {
  id: ExtensionId;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

const EXTENSIONS: ExtensionRow[] = [
  {
    id: 'date-ideas',
    icon: 'heart',
    title: 'Date ideas',
    description:
      "A home card with reunion-aware date ideas — virtual while you're apart, in person as your reunion gets close.",
  },
  {
    id: 'gifts',
    icon: 'gift',
    title: 'Gifts & acts of service',
    description: 'A home card with gift ideas and acts of service for him, her, or anyone — plus your own additions.',
  },
  {
    id: 'weekly-share',
    icon: 'chatbox-ellipses',
    title: 'Weekly share',
    description: 'A home card for one shared message, quote, or link each week — a little ritual between you two.',
  },
  {
    id: 'habits',
    icon: 'checkmark-circle',
    title: "Today's habits",
    description: "A home card with today's habits — check off what's left and jump to the full timeline.",
  },
  {
    id: 'pet',
    icon: 'paw',
    title: 'Couple pet',
    description: 'A home card for your shared virtual pets — check in on your companions and jump into the play area.',
  },
  {
    id: 'cycle-tracking',
    icon: 'heart-circle',
    title: 'Cycle tracking',
    description: 'A home card for couples cycle tracking — optionally share selected details with your partner for support.',
  },
];

// where a dragged row's finger position would land among the OTHER rows' natural (non-dragged)
// stacking — returns an index directly usable as the splice-insert position once the dragged
// row is pulled out of `order`
function hoverIndex(order: ExtensionId[], rowHeights: Record<string, number>, draggedId: string, centerY: number): number {
  'worklet';
  const others = order.filter((id) => id !== draggedId);
  let cumulative = 0;
  for (let i = 0; i < others.length; i++) {
    const height = rowHeights[others[i]] ?? 0;
    const mid = cumulative + height / 2;
    if (centerY < mid) return i;
    cumulative += height;
  }
  return others.length;
}

function reorder(ids: ExtensionId[], from: number, to: number): ExtensionId[] {
  if (from === to) return ids;
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export default function ExtensionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [enabled, setEnabled] = useState(DEFAULT_EXTENSION_ENABLED);
  const [order, setOrder] = useState<ExtensionId[]>(EXTENSION_IDS);
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  useEffect(() => {
    loadExtensionEnabled().then(setEnabled);
    loadExtensionOrder().then(setOrder);
  }, []);

  function onRowLayout(id: string, e: LayoutChangeEvent) {
    const height = e.nativeEvent.layout.height;
    setRowHeights((prev) => (prev[id] === height ? prev : { ...prev, [id]: height }));
  }

  function onToggleEnabled(id: ExtensionId, value: boolean) {
    setEnabled((prev) => {
      const next = { ...prev, [id]: value };
      saveExtensionEnabled(next);
      return next;
    });
  }

  function onDragMove(id: ExtensionId, index: number) {
    setOrder((prev) => {
      const next = reorder(prev, prev.indexOf(id), index);
      saveExtensionOrder(next);
      return next;
    });
  }

  async function onSubmitFeedback() {
    const trimmed = feedbackMessage.trim();
    if (trimmed.length === 0) return;
    setFeedbackSending(true);
    setFeedbackError(null);
    setFeedbackSent(false);
    try {
      await submitFeedback('feedback', trimmed);
      setFeedbackSent(true);
      setFeedbackMessage('');
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Could not send');
    } finally {
      setFeedbackSending(false);
    }
  }

  const orderedExtensions = order.map((id) => EXTENSIONS.find((ext) => ext.id === id)).filter((ext): ext is ExtensionRow => !!ext);

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader
        title="Extensions"
        leftLabel={editing ? undefined : 'Edit'}
        leftIcon={editing ? 'close' : undefined}
        onLeftPress={() => setEditing(!editing)}
        rightLabel="Done"
        onRightPress={() => router.back()}
      />
      <Animated.ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        <NBCard style={styles.rowsCard}>
          {orderedExtensions.map((ext, index) => (
            <ExtensionRowItem
              key={ext.id}
              ext={ext}
              index={index}
              order={order}
              rowHeights={rowHeights}
              editing={editing}
              enabled={enabled[ext.id]}
              isLast={index === orderedExtensions.length - 1}
              onToggle={(value) => onToggleEnabled(ext.id, value)}
              onLayout={(e) => onRowLayout(ext.id, e)}
              onDragMove={onDragMove}
              theme={theme}
            />
          ))}
        </NBCard>
        <ThemedText type="small" themeColor="textSecondary">
          {editing
            ? 'Drag the handles to reorder how these cards appear on Home.'
            : 'Tap Edit to reorder how these cards appear on Home.'}
        </ThemedText>

        <NBCard style={styles.feedbackCard}>
          <ThemedText type="smallBold">Have a suggestion?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            We&apos;d love to hear what would make No Bounds better for you two.
          </ThemedText>
          {feedbackError ? (
            <ThemedText type="small" themeColor="destructive">
              {feedbackError}
            </ThemedText>
          ) : null}
          {feedbackSent ? (
            <ThemedText type="small" themeColor="accent">
              Thanks — we got your message!
            </ThemedText>
          ) : null}
          <TextInput
            value={feedbackMessage}
            onChangeText={(text) => {
              setFeedbackMessage(text);
              setFeedbackSent(false);
            }}
            placeholder="Type your suggestion…"
            placeholderTextColor={theme.textSecondary}
            multiline
            style={[styles.feedbackInput, { color: theme.textPrimary, backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
          />
          <NBPrimaryButton
            title={feedbackSending ? 'Submitting…' : 'Send'}
            onPress={onSubmitFeedback}
            disabled={feedbackSending || feedbackMessage.trim().length === 0}
          />
        </NBCard>
      </Animated.ScrollView>
    </ThemedView>
  );
}

function ExtensionRowItem({
  ext,
  index,
  order,
  rowHeights,
  editing,
  enabled,
  isLast,
  onToggle,
  onLayout,
  onDragMove,
  theme,
}: {
  ext: ExtensionRow;
  index: number;
  order: ExtensionId[];
  rowHeights: Record<string, number>;
  editing: boolean;
  enabled: boolean;
  isLast: boolean;
  onToggle: (value: boolean) => void;
  onLayout: (e: LayoutChangeEvent) => void;
  onDragMove: (id: ExtensionId, index: number) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const pan = Gesture.Pan()
    .enabled(editing)
    .onBegin(() => {
      isDragging.value = true;
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;

      let baseTop = 0;
      for (let i = 0; i < order.length; i++) {
        if (order[i] === ext.id) break;
        baseTop += rowHeights[order[i]] ?? 0;
      }
      const height = rowHeights[ext.id] ?? 0;
      const centerY = baseTop + e.translationY + height / 2;
      const target = hoverIndex(order, rowHeights, ext.id, centerY);
      runOnJS(onDragMove)(ext.id, target);
    })
    .onEnd(() => {
      isDragging.value = false;
      translateY.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: isDragging.value ? 1 : 0,
    backgroundColor: isDragging.value ? theme.backgroundSecondary : 'transparent',
  }));

  return (
    <Animated.View
      layout={LinearTransition}
      onLayout={onLayout}
      style={[styles.row, animatedStyle, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
      <Pressable style={styles.rowText} onPress={() => onToggle(!enabled)}>
        <View style={styles.rowTitleLine}>
          <Ionicons name={ext.icon} size={14} color={theme.accent} />
          <ThemedText type="smallBold">{ext.title}</ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.rowDescription}>
          {ext.description}
        </ThemedText>
      </Pressable>
      <Switch
        value={enabled}
        onValueChange={onToggle}
        trackColor={{ true: theme.accent, false: theme.border }}
        thumbColor="#ffffff"
      />
      {editing ? (
        <GestureDetector gesture={pan}>
          <View style={styles.dragHandle} hitSlop={8}>
            <Ionicons name="reorder-three" size={24} color={theme.textSecondary} />
          </View>
        </GestureDetector>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  rowsCard: { gap: 0, padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  rowText: { flex: 1, gap: 4 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowDescription: { lineHeight: 18 },
  dragHandle: { paddingLeft: 4, paddingVertical: 4 },
  feedbackCard: { gap: 12 },
  feedbackInput: { borderRadius: 12, borderWidth: 1, padding: 12, minHeight: 100, textAlignVertical: 'top', fontSize: 15 },
});
