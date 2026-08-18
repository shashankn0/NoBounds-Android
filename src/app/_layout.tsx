import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useRef } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Palettes, type PaletteId } from '@/constants/palettes';
import { SessionProvider, useSession } from '@/contexts/session-context';
import { PaletteProvider, usePalette } from '@/contexts/palette-context';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading, session, appSettings } = useSession();
  const { isDark, colors, setPaletteId, setAppearanceMode } = usePalette();
  const hasHydratedPalette = useRef(false);

  // Pull the user's saved palette/appearance mode down from Supabase once per session, so a
  // local device switch doesn't get clobbered on every re-render.
  useEffect(() => {
    if (!appSettings || hasHydratedPalette.current) return;
    hasHydratedPalette.current = true;
    if (appSettings.palette_id in Palettes) {
      setPaletteId(appSettings.palette_id as PaletteId);
    }
    setAppearanceMode(appSettings.appearance_mode);
  }, [appSettings, setPaletteId, setAppearanceMode]);

  useEffect(() => {
    if (!session) {
      hasHydratedPalette.current = false;
    }
  }, [session]);

  const navTheme = useMemo<Theme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.background,
        card: colors.background,
        text: colors.textPrimary,
        border: colors.border,
      },
    };
  }, [isDark, colors]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <ThemeProvider value={navTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pairing" options={{ presentation: 'modal', headerShown: true, title: 'Pairing' }} />
          <Stack.Screen name="profile" options={{ headerShown: true, title: 'Profile' }} />
          <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
          <Stack.Screen name="settings/index" options={{ headerShown: true, title: 'Settings' }} />
          <Stack.Screen name="settings/appearance" options={{ headerShown: true, title: 'Appearance' }} />
          <Stack.Screen name="pet" options={{ headerShown: true, title: 'Pet' }} />
          <Stack.Screen name="date-ideas" options={{ headerShown: true, title: 'Date ideas' }} />
          <Stack.Screen name="gifts" options={{ headerShown: true, title: 'Gift ideas' }} />
          <Stack.Screen name="calendar" options={{ headerShown: true, title: 'Calendar' }} />
          <Stack.Screen name="cycle-tracking" options={{ headerShown: true, title: 'Cycle tracking' }} />
          <Stack.Screen name="weekly-share" options={{ headerShown: true, title: 'Weekly share' }} />
          <Stack.Screen name="habit-form" options={{ presentation: 'modal' }} />
          <Stack.Screen name="memory-form" options={{ presentation: 'modal' }} />
          <Stack.Screen name="extensions" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <PaletteProvider>
      <SessionProvider>
        <AnimatedSplashOverlay />
        <RootNavigator />
      </SessionProvider>
    </PaletteProvider>
  );
}
