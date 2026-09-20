import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type MessageBubbleAlignment = 'leading' | 'trailing' | 'center';

// port of features/prompt/components/messagebubbleview.swift — the shared chat-bubble shell
// used by prompt questions (center/system), answers (leading/trailing), and free-form messages
export function MessageBubble({
  text,
  alignment,
  background,
  foreground,
  isTappable = false,
  accessory,
}: {
  text: string;
  alignment: MessageBubbleAlignment;
  background: string;
  foreground: string;
  isTappable?: boolean;
  accessory?: string | null;
}) {
  const theme = useTheme();
  const isCenter = alignment === 'center';

  return (
    <View style={[styles.row, alignment === 'trailing' && styles.rowTrailing, isCenter && styles.rowCenter]}>
      <View
        style={[
          styles.bubble,
          { backgroundColor: background },
          isCenter ? styles.bubbleCenter : styles.bubbleBounded,
          alignment === 'trailing' && styles.bubbleTrailing,
          isTappable && { borderWidth: 1, borderColor: theme.border + '99' },
        ]}>
        <ThemedText style={[styles.text, { color: foreground }, isCenter && styles.textCenter]}>
          {text}
        </ThemedText>
        {accessory ? (
          <ThemedText type="small" style={[styles.accessory, { color: foreground, opacity: 0.85 }]}>
            {accessory}
          </ThemedText>
        ) : isTappable ? (
          <Ionicons name="chevron-forward" size={12} color={foreground} style={{ opacity: 0.7 }} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  rowTrailing: { justifyContent: 'flex-end' },
  rowCenter: { justifyContent: 'center' },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleBounded: { maxWidth: '82%' },
  bubbleCenter: { maxWidth: '100%' },
  bubbleTrailing: { alignSelf: 'flex-end' },
  text: { fontSize: 16, lineHeight: 21, flexShrink: 1 },
  // roboto runs wider than ios's font, so system bubbles drop a point to keep the same line breaks
  textCenter: { textAlign: 'center', fontSize: 15 },
  accessory: { fontWeight: '600' },
});
