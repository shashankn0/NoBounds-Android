import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { PanResponder, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

type ExtensionRow = {
  id: string;
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

// which home cards show by default — matches EXTENSIONS ids above
const DEFAULT_ENABLED: Record<string, boolean> = {
  'date-ideas': false,
  gifts: false,
  'weekly-share': false,
  habits: true,
  pet: true,
  'cycle-tracking': true,
};

// edit mode drops the descriptions so every row is the same height — that's what makes the drag
// math exact: the dragged row trades places once it passes half a row in either direction
const DRAG_ROW_HEIGHT = 56;

// where the dragged row would land: one slot per DRAG_ROW_HEIGHT of finger travel, clamped
function targetIndex(drag: Drag, rowCount: number): number {
  const steps = Math.round(drag.dy / DRAG_ROW_HEIGHT);
  return Math.max(0, Math.min(rowCount - 1, drag.startIndex + steps));
}

function reorder(ids: string[], from: number, to: number): string[] {
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// snapshot taken when the drag starts, so every move is a pure function of the finger's dy
type Drag = { id: string; startIndex: number; startOrder: string[]; dy: number };

export default function ExtensionsScreen() {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [enabled, setEnabled] = useState(DEFAULT_ENABLED);
  const [order, setOrder] = useState<string[]>(() => EXTENSIONS.map((ext) => ext.id));
  const [drag, setDrag] = useState<Drag | null>(null);

  // live order while dragging: the committed order with the dragged row moved to its target slot
  const displayOrder = drag ? reorder(drag.startOrder, drag.startIndex, targetIndex(drag, order.length)) : order;
  // leftover travel inside the current slot — keeps the row under the finger between swaps
  const dragOffset = drag ? drag.dy - (targetIndex(drag, order.length) - drag.startIndex) * DRAG_ROW_HEIGHT : 0;

  // rebuilt every render on purpose: each handler then closes over the current drag state
  function dragHandlers(id: string) {
    const finish = () => {
      setOrder(displayOrder);
      setDrag(null);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setDrag({ id, startIndex: order.indexOf(id), startOrder: order, dy: 0 }),
      onPanResponderMove: (_event, gesture) =>
        setDrag((prev) => (prev && prev.id === id ? { ...prev, dy: gesture.dy } : prev)),
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    }).panHandlers;
  }

  const orderedExtensions = displayOrder
    .map((id) => EXTENSIONS.find((ext) => ext.id === id))
    .filter((ext): ext is ExtensionRow => ext !== undefined);

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader
        title="Extensions"
        leftLabel={editing ? 'Done' : 'Edit'}
        onLeftPress={() => setEditing(!editing)}
        rightLabel="Done"
        onRightPress={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.container} scrollEnabled={drag === null}>
        <NBCard style={styles.rowsCard}>
          {orderedExtensions.map((ext) =>
            editing ? (
              <View
                key={ext.id}
                style={[
                  styles.dragRow,
                  drag?.id === ext.id && {
                    transform: [{ translateY: dragOffset }],
                    backgroundColor: theme.backgroundSecondary,
                    zIndex: 1,
                    elevation: 4,
                  },
                ]}>
                <Ionicons name={ext.icon} size={22} color={theme.accent} style={styles.rowIcon} />
                <ThemedText type="smallBold" style={styles.dragTitle}>
                  {ext.title}
                </ThemedText>
                <View {...dragHandlers(ext.id)} style={styles.dragHandle}>
                  <Ionicons name="reorder-three" size={26} color={theme.textSecondary} />
                </View>
              </View>
            ) : (
              <View key={ext.id} style={styles.row}>
                <Ionicons name={ext.icon} size={22} color={theme.accent} style={styles.rowIcon} />
                <View style={styles.rowText}>
                  <ThemedText type="smallBold">{ext.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.rowDescription}>
                    {ext.description}
                  </ThemedText>
                </View>
                <Switch
                  value={enabled[ext.id]}
                  onValueChange={(value) => setEnabled((prev) => ({ ...prev, [ext.id]: value }))}
                  trackColor={{ true: theme.accent, false: theme.border }}
                />
              </View>
            )
          )}
        </NBCard>
        <ThemedText type="small" themeColor="textSecondary">
          {editing
            ? 'Drag the handles to reorder how these cards appear on Home.'
            : 'Tap Edit to reorder how these cards appear on Home.'}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  rowsCard: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, gap: 12 },
  rowIcon: { marginTop: 2 },
  rowText: { flex: 1, gap: 4 },
  rowDescription: { lineHeight: 18 },
  dragRow: { flexDirection: 'row', alignItems: 'center', height: DRAG_ROW_HEIGHT, gap: 12, borderRadius: 10 },
  dragTitle: { flex: 1 },
  dragHandle: { paddingHorizontal: 6, paddingVertical: 12 },
});
