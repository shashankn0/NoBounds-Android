import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type NBListRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress?: () => void;
  trailing?: string;
};

// mirrors the nav-row pattern used throughout profileview.swift / settingsplaceholderview.swift:
// leading accent icon, title, trailing chevron. tap to navigate.
export function NBListRow({ icon, title, onPress, trailing }: NBListRowProps) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={20} color={theme.accent} style={styles.icon} />
      <ThemedText type="default" style={styles.title}>
        {title}
      </ThemedText>
      {trailing ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.trailing}>
          {trailing}
        </ThemedText>
      ) : null}
      <Ionicons name="chevron-forward" size={13} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ios settingsRow (settings + profile): 12pt gap, 28pt icon column, 4pt vertical padding — the 12pt
  // between rows comes from the card's own gap
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  icon: { width: 28, marginRight: 12, textAlign: 'center' },
  title: { flex: 1 },
  trailing: { marginRight: 6 },
});
