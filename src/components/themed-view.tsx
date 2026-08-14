import { View, type ViewProps } from 'react-native';

import type { PaletteColors } from '@/constants/palettes';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: keyof PaletteColors;
};

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();

  return <View style={[{ backgroundColor: theme[type ?? 'background'] }, style]} {...otherProps} />;
}
