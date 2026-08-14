import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SessionProvider, useSession } from '@/contexts/session-context';
import { PaletteProvider, usePalette } from '@/contexts/palette-context';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading, session } = useSession();
  const { isDark, colors } = usePalette();

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
