/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { usePalette } from '@/contexts/palette-context';

// shortcut to just the active color tokens, without the rest of palette state
export function useTheme() {
  return usePalette().colors;
}
