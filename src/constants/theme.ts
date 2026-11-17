// Societree palette (CLAUDE.md "Design"), mirroring the prototype's CSS variables.
import { useColorScheme } from 'react-native';

export const Brand = {
  header: '#0F241C',
  headerSubtle: '#9fb8aa',
  urgent: '#c0392b',
  medium: '#d9822b',
  low: '#2e8b57',
} as const;

export const Palette = {
  light: {
    bg: '#f3f7f4',
    card: '#ffffff',
    ink: '#14281f',
    muted: '#5d7066',
    line: '#dde6e0',
    accent: '#1f7a4d',
    accentInk: '#ffffff',
  },
  dark: {
    bg: '#0c1713',
    card: '#142720',
    ink: '#e6efe9',
    muted: '#93a89c',
    line: '#223a30',
    accent: '#3fbf82',
    accentInk: '#06140d',
  },
} as const;

export type Colors = (typeof Palette)['light'] | (typeof Palette)['dark'];

export function useColors(): Colors {
  return Palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export type Priority = 'low' | 'medium' | 'urgent';

export const priorityColor = (p: Priority | null | undefined) =>
  p === 'urgent' ? Brand.urgent : p === 'medium' ? Brand.medium : Brand.low;
