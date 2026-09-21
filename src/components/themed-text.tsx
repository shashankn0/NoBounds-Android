import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts } from '@/constants/theme';
import type { PaletteColors } from '@/constants/palettes';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'bodyBold' | 'title' | 'subtitle' | 'small' | 'smallBold' | 'link' | 'code';
  themeColor?: keyof PaletteColors;
};

// text that auto-colors/sizes itself from the active palette — use instead of raw <Text>
export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'textPrimary'] },
        type === 'default' && styles.default,
        type === 'bodyBold' && styles.bodyBold,
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

// mirrors ios's semantic text styles (nbtext.swift + the .font(...) calls across features), scaled by
// ~0.92 — the test phone is 360dp wide vs an iphone's 393pt, so identical point sizes read ~9%
// bigger relative to the screen. weights match ios exactly (semibold = 600, not bold = 700).
//   default   = .body            (17 -> 16)
//   bodyBold  = .body.semibold   (17 -> 16)   item titles, nav-bar titles
//   title     = .title2.semibold (22 -> 20)   NBTitleText, every card/section title
//   subtitle  = .title3.semibold (20 -> 18)
//   small     = .caption         (12 -> 12: kept, so secondary copy stays legible on roboto)
//   smallBold = .subheadline.semibold (15 -> 14)
const styles = StyleSheet.create({
  default: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyBold: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  subtitle: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  small: { fontSize: 12, lineHeight: 17, fontWeight: '400' },
  smallBold: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  link: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' }) ?? '500',
    fontSize: 12,
  },
});
