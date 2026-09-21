import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
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
  // custom content for the right side (e.g. a compound "+ | Done" pill) — overrides rightLabel
  rightSlot?: ReactNode;
  // 'left' left-aligns the title (matches ios's inline nav bar title, which sits at the
  // leading edge next to a leading toolbar item) instead of the default centered one, and
  // drops the empty leading spacer when there's no left pill. Still the same small bold
  // single-line style as centered — ios's `.navigationBarTitleDisplayMode(.inline)` is not
  // the large-title style.
  titleAlign?: 'center' | 'left';
};

// mirrors the modal-sheet nav bar used across createentrysheet/creatememoryview/extensionsview:
// a pill button on each side, bold centered title. custom (not the native stack header) so the
// pill styling matches exactly.
export function FormHeader({
  title,
  leftLabel,
  leftIcon,
  onLeftPress,
  rightLabel,
  onRightPress,
  rightDisabled,
  rightSlot,
  titleAlign = 'center',
}: FormHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const hasLeftPill = !!(leftLabel || leftIcon);

  return (
    <View style={[styles.row, { paddingTop: insets.top + 12 }]}>
      {hasLeftPill || titleAlign === 'center' ? (
        <View style={styles.side}>
          {hasLeftPill ? (
            <Pressable onPress={onLeftPress} style={[styles.pill, { backgroundColor: theme.surface }]}>
              {leftIcon ? <Ionicons name={leftIcon} size={20} color={theme.textPrimary} /> : null}
              {leftLabel ? (
                <ThemedText type="default">
                  {leftLabel}
                </ThemedText>
              ) : null}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ThemedText type="bodyBold" style={[styles.title, titleAlign === 'left' && styles.titleLeft]} numberOfLines={1}>
        {title}
      </ThemedText>

      <View style={[styles.side, styles.sideRight]}>
        {rightSlot ? (
          rightSlot
        ) : rightLabel ? (
          <Pressable
            onPress={onRightPress}
            disabled={rightDisabled}
            style={[styles.pill, { backgroundColor: theme.surface, opacity: rightDisabled ? 0.5 : 1 }]}>
            <ThemedText type="bodyBold" themeColor={rightDisabled ? 'textSecondary' : 'accent'}>
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
  titleLeft: { textAlign: 'left', paddingRight: 8 },
});
