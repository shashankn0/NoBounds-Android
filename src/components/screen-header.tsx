import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReunionPopover } from '@/components/reunion-popover';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { fetchUnreadNotificationCount } from '@/lib/notifications';

type ScreenHeaderProps = {
  // shows "Paired with: {partner name}" in the center, tappable through to /pairing —
  // mirrors ios's coupleheaderbutton, only rendered once actually paired
  showPairing?: boolean;
};

// mirrors the toolbar every tab gets in maintabview.swift: notificationtoolbarbutton (bell, top-left)
// + profiletoolbarbutton (avatar, top-right), with an optional centered "paired with" label.
// pinned like ios's nav bar (doesn't scroll away) — padded by the safe-area inset so it clears the
// status bar instead of being clipped by it.
export function ScreenHeader({ showPairing = false }: ScreenHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { couple, featuredAvatarUrl } = useSession();
  const [hasUnread, setHasUnread] = useState(false);
  const [showReunionPopover, setShowReunionPopover] = useState(false);

  // refetched on every tab focus, same as re-checking on each screen appearance in ios
  useFocusEffect(
    useCallback(() => {
      fetchUnreadNotificationCount()
        .then((count) => setHasUnread(count > 0))
        .catch(() => {});
    }, [])
  );

  return (
    <View style={[styles.row, { paddingTop: insets.top + 4 }]}>
      <Pressable
        onPress={() => router.push('/notifications')}
        style={[styles.iconButton, hasUnread && { backgroundColor: theme.accentMuted + '59' }]}>
        <Ionicons name="notifications" size={17} color={hasUnread ? theme.accent : theme.textPrimary} />
      </Pressable>

      {showPairing && couple ? (
        <>
          <Pressable onPress={() => setShowReunionPopover(true)} style={[styles.centerLabel, styles.pairingRow]} hitSlop={8}>
            {/* ios PairedWithHeaderLabel: .caption, textSecondary; chevron is caption2 semibold at 80% */}
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              Paired with: {couple.partnerName?.trim() || 'partner'}
            </ThemedText>
            <Ionicons name="chevron-down" size={11} color={theme.textSecondary + 'CC'} style={styles.chevron} />
          </Pressable>
          <ReunionPopover
            visible={showReunionPopover}
            onClose={() => setShowReunionPopover(false)}
            coupleId={couple.id}
            partnerName={couple.partnerName?.trim() || 'partner'}
          />
        </>
      ) : (
        <View style={styles.centerLabel} />
      )}

      <Pressable
        onPress={() => router.push('/profile')}
        style={[styles.avatarButton, { backgroundColor: theme.accentMuted }]}>
        {featuredAvatarUrl ? (
          <Image source={{ uri: featuredAvatarUrl }} style={styles.avatarImage} resizeMethod="resize" />
        ) : (
          <Ionicons name="person" size={17} color={theme.textOnAccent} />
        )}
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
    paddingBottom: 8,
  },
  // ios toolbar buttons (notificationtoolbarbutton / profiletoolbarbutton) are 32x32
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 32, height: 32 },
  centerLabel: { flex: 1, alignItems: 'center' },
  pairingRow: { flexDirection: 'row', justifyContent: 'center' },
  chevron: { marginLeft: 4 },
});
