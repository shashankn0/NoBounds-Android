import { View, type ViewProps } from 'react-native';

import type { PaletteColors } from '@/constants/palettes';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: keyof PaletteColors;
};

// view that auto-fills its background from the active palette — use instead of raw <View> for screens
export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();

  return <View style={[{ backgroundColor: theme[type ?? 'background'] }, style]} {...otherProps} />;
}
