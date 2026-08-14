import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts } from '@/constants/theme';
import type { PaletteColors } from '@/constants/palettes';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'subtitle' | 'small' | 'smallBold' | 'link' | 'code';
  themeColor?: keyof PaletteColors;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'textPrimary'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'subtitle' && styles.subtitle,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'link' && styles.link,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
  subtitle: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  smallBold: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  link: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' }) ?? '500',
    fontSize: 12,
  },
});
