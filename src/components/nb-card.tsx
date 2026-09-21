import { StyleSheet, View, type ViewProps } from 'react-native';

import { usePalette } from '@/contexts/palette-context';
import { useTheme } from '@/hooks/use-theme';

type NBCardProps = ViewProps & { elevated?: boolean };

// mirrors ../nobounds/nobounds/core/ui/nbcard.swift: 16pt padding, 16pt radius, hairline border, soft shadow.
// the standard card shell used across almost every screen. like ios, the shadow is light-mode only —
// on dark backgrounds it reads as dirt and the border carries the separation instead.
export function NBCard({ style, elevated = false, ...rest }: NBCardProps) {
  const theme = useTheme();
  const { isDark } = usePalette();

  return (
    <View
      style={[
        styles.card,
        !isDark && styles.cardShadow,
        {
          backgroundColor: elevated ? theme.surfaceElevated : theme.surface,
          borderColor: theme.border,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});
