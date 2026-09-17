import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Palettes, type PaletteId } from '@/constants/palettes';
import { SessionProvider, useSession } from '@/contexts/session-context';
import { PaletteProvider, usePalette } from '@/contexts/palette-context';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading, session, appSettings } = useSession();
  const { isDark, colors, setPaletteId, setAppearanceMode } = usePalette();
  const hasHydratedPalette = useRef(false); // only pull the saved theme once per session

  // pull the user's saved palette/appearance mode down from supabase once per session, so a
  // local device switch doesn't get clobbered on every re-render.
  useEffect(() => {
    if (!appSettings || hasHydratedPalette.current) return;
    hasHydratedPalette.current = true;
    if (appSettings.palette_id in Palettes) {
      setPaletteId(appSettings.palette_id as PaletteId);
    }
    setAppearanceMode(appSettings.appearance_mode);
  }, [appSettings, setPaletteId, setAppearanceMode]);

  // reset the hydration flag on sign-out, so the next sign-in re-hydrates
  useEffect(() => {
    if (!session) {
      hasHydratedPalette.current = false;
    }
  }, [session]);

  // maps our palette tokens onto expo-router's nav theme (header/tab bar chrome)
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
    return null; // splash stays up until session/theme are ready
  }

  return (
    <ThemeProvider value={navTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* signed out -> onboarding/auth only */}
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        {/* signed in -> main tabs + every modal/detail screen */}
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pairing" options={{ presentation: 'modal', headerShown: true, title: 'Pairing' }} />
          <Stack.Screen name="profile" options={{ headerShown: true, title: 'Profile' }} />
          <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
          <Stack.Screen name="settings/index" options={{ headerShown: true, title: 'Settings' }} />
          <Stack.Screen name="settings/appearance" options={{ headerShown: true, title: 'Appearance' }} />
          <Stack.Screen name="account" options={{ headerShown: true, title: 'Account' }} />
          <Stack.Screen name="about" options={{ headerShown: true, title: 'From the creators' }} />
          <Stack.Screen name="feedback-support" options={{ headerShown: true, title: 'Feedback & support' }} />
          <Stack.Screen name="request-data" options={{ presentation: 'modal' }} />
          <Stack.Screen name="pet" options={{ headerShown: true, title: 'Pet' }} />
          <Stack.Screen name="date-ideas" options={{ headerShown: false }} />
          <Stack.Screen name="date-idea-form" options={{ presentation: 'modal' }} />
          <Stack.Screen name="gifts" options={{ headerShown: false }} />
          <Stack.Screen name="gift-idea-form" options={{ presentation: 'modal' }} />
          <Stack.Screen name="calendar" options={{ headerShown: true, title: 'Calendar' }} />
          <Stack.Screen name="cycle-tracking" options={{ headerShown: false }} />
          <Stack.Screen name="cycle-sharing-settings" options={{ headerShown: true, title: 'Sharing settings' }} />
          <Stack.Screen name="weekly-share" options={{ presentation: 'modal' }} />
          <Stack.Screen name="habit-form" options={{ presentation: 'modal' }} />
          <Stack.Screen name="memory-form" options={{ presentation: 'modal' }} />
          <Stack.Screen
            name="extensions"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.5, 1],
              sheetGrabberVisible: true,
              sheetInitialDetentIndex: 0,
              sheetExpandsWhenScrolledToEdge: true,
            }}
          />
          <Stack.Screen
            name="day-habits"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.5, 1],
              sheetGrabberVisible: true,
              sheetInitialDetentIndex: 0,
              sheetExpandsWhenScrolledToEdge: true,
            }}
          />
          <Stack.Screen
            name="cycle-log"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.75, 1],
              sheetGrabberVisible: true,
              sheetInitialDetentIndex: 0,
              sheetExpandsWhenScrolledToEdge: true,
            }}
          />
          <Stack.Screen name="photo-detail" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaletteProvider>
        <SessionProvider>
          <AnimatedSplashOverlay />
          <RootNavigator />
        </SessionProvider>
      </PaletteProvider>
    </GestureHandlerRootView>
  );
}
