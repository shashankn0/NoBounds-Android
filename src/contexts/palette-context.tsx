import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { DefaultPaletteId, Palettes, type PaletteId } from '@/constants/palettes';
import { useColorScheme } from '@/hooks/use-color-scheme';

type AppearanceMode = 'light' | 'dark' | 'system';

type PaletteContextValue = {
  paletteId: PaletteId;
  setPaletteId: (id: PaletteId) => void;
  appearanceMode: AppearanceMode;
  setAppearanceMode: (mode: AppearanceMode) => void;
  isDark: boolean;
  colors: (typeof Palettes)[PaletteId]['light'];
};

const PaletteContext = createContext<PaletteContextValue | undefined>(undefined);

export function PaletteProvider({ children }: { children: ReactNode }) {
  const [paletteId, setPaletteId] = useState<PaletteId>(DefaultPaletteId);
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>('system');
  const systemScheme = useColorScheme();

  const isDark =
    appearanceMode === 'dark' ||
    (appearanceMode === 'system' && systemScheme === 'dark');

  const colors = useMemo(
    () => Palettes[paletteId][isDark ? 'dark' : 'light'],
    [paletteId, isDark]
  );

  return (
    <PaletteContext.Provider
      value={{ paletteId, setPaletteId, appearanceMode, setAppearanceMode, isDark, colors }}>
      {children}
    </PaletteContext.Provider>
  );
}

export function usePalette() {
  const context = useContext(PaletteContext);
  if (!context) {
    throw new Error('usePalette must be used within a PaletteProvider');
  }
  return context;
}
