/**
 * BatchFit design tokens — sourced from the mockups in `batchFitDesignWork/`
 * (see `BatchFit Brand.dc.html`). Green leads (Prep Green), coral is the sparing
 * accent for "act here", and everything sits on warm Paper (light) or Deep Kale
 * (dark). Fold new design values in here rather than hard-coding them in screens.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Paper surfaces, Ink text.
    background: '#FBFAF8',
    backgroundElement: '#ECEBE4',
    backgroundSelected: '#E4E2D8',
    text: '#16201A',
    textSecondary: '#6B756D',
    border: '#E4E2D8',
    // Prep Green leads; coral is the reserved accent.
    tint: '#2E9E5B',
    onTint: '#FFFFFF',
    accent: '#FB6E4E',
    danger: '#D64541',
  },
  dark: {
    // Deep Kale surfaces, Paper text, brighter mint-green accent.
    background: '#141E18',
    backgroundElement: '#1B2E22',
    backgroundSelected: '#22332A',
    text: '#F6F5F0',
    textSecondary: '#8FA396',
    border: '#2A4233',
    tint: '#46C57E',
    onTint: '#0D1611',
    accent: '#FB6E4E',
    danger: '#F2837F',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Brand fonts (loaded in the root layout via `@expo-google-fonts`): Schibsted
 * Grotesk for display, Hanken Grotesk for body/UI. The family strings match the
 * font names those packages register.
 */
export const Fonts = {
  display: 'SchibstedGrotesk_700Bold',
  displayMedium: 'SchibstedGrotesk_500Medium',
  body: 'HankenGrotesk_500Medium',
  bodySemibold: 'HankenGrotesk_600SemiBold',
  bodyBold: 'HankenGrotesk_700Bold',
  mono: Platform.select({ ios: 'ui-monospace', default: 'monospace' }) as string,
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radii = {
  input: 12,
  button: 15,
  tile: 27,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
