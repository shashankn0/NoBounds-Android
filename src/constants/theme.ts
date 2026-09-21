import '@/global.css';

import { Platform } from 'react-native';

// per-platform font stacks — palette colors live in constants/palettes.ts instead
export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

// shared spacing scale, in px
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

// clearance scroll content needs above the floating tab bar (see app-tabs.tsx), on top of
// the safe-area bottom inset each screen already adds separately. the slimmed pill is ~46px tall +
// 6px top pad + the 8px it holds itself off the system nav bar (=60px), plus ~12px of breathing
// room so the last card never touches it.
export const BottomTabInset = Platform.select({ ios: 50, android: 72 }) ?? 0;
export const MaxContentWidth = 800; // caps content width on web/tablet
