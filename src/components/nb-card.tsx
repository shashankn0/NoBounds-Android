import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type NBCardProps = ViewProps & { elevated?: boolean };

// Mirrors ../NoBounds/NoBounds/Core/UI/NBCard.swift: 16pt padding, 16pt radius, hairline border, soft shadow.
export function NBCard({ style, elevated = false, ...rest }: NBCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
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
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});
