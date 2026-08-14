import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type ScreenHeaderProps = {
  centerLabel?: string;
};

// Mirrors the toolbar every tab gets in MainTabView.swift: NotificationToolbarButton (bell, top-left)
// + ProfileToolbarButton (avatar, top-right), with an optional centered "paired with" label.
// Pinned like iOS's nav bar (doesn't scroll away) — padded by the safe-area inset so it clears the
// status bar instead of being clipped by it.
export function ScreenHeader({ centerLabel }: ScreenHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.row, { paddingTop: insets.top + 8 }]}>
      <Pressable
        onPress={() => router.push('/notifications')}
        style={[styles.iconButton, { backgroundColor: theme.surface }]}>
        <Ionicons name="notifications-outline" size={20} color={theme.textPrimary} />
      </Pressable>

      {centerLabel ? (
        <ThemedText type="smallBold" style={styles.centerLabel} numberOfLines={1}>
          {centerLabel}
        </ThemedText>
      ) : (
        <View style={styles.centerLabel} />
      )}

      <Pressable
        onPress={() => router.push('/profile')}
        style={[styles.avatarButton, { backgroundColor: theme.accentMuted }]}>
        <Ionicons name="person" size={20} color={theme.textOnAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: { flex: 1, textAlign: 'center' },
});
