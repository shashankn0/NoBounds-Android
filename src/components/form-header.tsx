import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type FormHeaderProps = {
  title: string;
  leftLabel?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  onLeftPress?: () => void;
  rightLabel?: string;
  onRightPress?: () => void;
  rightDisabled?: boolean;
};

// Mirrors the modal-sheet nav bar used across CreateEntrySheet/CreateMemoryView/ExtensionsView:
// a pill button on each side, bold centered title. Custom (not the native Stack header) so the
// pill styling matches exactly.
export function FormHeader({
  title,
  leftLabel,
  leftIcon,
  onLeftPress,
  rightLabel,
  onRightPress,
  rightDisabled,
}: FormHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.row, { paddingTop: insets.top + 12 }]}>
      <View style={styles.side}>
        {leftLabel || leftIcon ? (
          <Pressable onPress={onLeftPress} style={[styles.pill, { backgroundColor: theme.surface }]}>
            {leftIcon ? <Ionicons name={leftIcon} size={20} color={theme.textPrimary} /> : null}
            {leftLabel ? (
              <ThemedText type="smallBold" themeColor="accent">
                {leftLabel}
              </ThemedText>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      <ThemedText type="smallBold" style={styles.title} numberOfLines={1}>
        {title}
      </ThemedText>

      <View style={[styles.side, styles.sideRight]}>
        {rightLabel ? (
          <Pressable
            onPress={onRightPress}
            disabled={rightDisabled}
            style={[styles.pill, { backgroundColor: theme.surface, opacity: rightDisabled ? 0.5 : 1 }]}>
            <ThemedText type="smallBold" themeColor={rightDisabled ? 'textSecondary' : 'accent'}>
              {rightLabel}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  side: { minWidth: 64 },
  sideRight: { alignItems: 'flex-end' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  title: { flex: 1, textAlign: 'center' },
});
