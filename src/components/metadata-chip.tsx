import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// mirrors ios's DateIdeaChip exactly: caption2 (~11pt) medium-weight text, caption2 icon,
// 8/4 padding, accent at 12% opacity — reused for both date-idea and gift-idea metadata
export function MetadataChip({ icon, label }: { icon?: keyof typeof Ionicons.glyphMap; label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: theme.accent + '1F' }]}>
      {icon ? <Ionicons name={icon} size={11} color={theme.accent} /> : null}
      <ThemedText themeColor="accent" style={styles.label}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '500' },
});
