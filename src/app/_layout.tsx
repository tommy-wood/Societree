import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const c = Palette[dark ? 'dark' : 'light'];
  const base = dark ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, background: c.bg, card: c.card, text: c.ink, border: c.line, primary: c.accent },
      }}>
      <StatusBar style="light" />
      <AuthProvider>
        <RootStack />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootStack() {
  const { loading, session, isMember, isAdmin, recovering } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) return null; // splash screen stays up

  const signedIn = !!session;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Brand.header },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}>
      {/* Arrived from a password-reset email: only the reset screen. */}
      <Stack.Protected guard={signedIn && recovering}>
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* Waiting for approval (or the profile couldn't be loaded). */}
      <Stack.Protected guard={signedIn && !recovering && !isMember}>
        <Stack.Screen name="pending" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !recovering && isMember}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ title: 'Your account', presentation: 'modal' }} />
        <Stack.Protected guard={isAdmin}>
          <Stack.Screen name="people" options={{ title: 'People' }} />
        </Stack.Protected>
      </Stack.Protected>
    </Stack>
  );
}
