import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { Palette } from '@/constants/theme';

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
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
