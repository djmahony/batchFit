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
    // Card + control surfaces (BatchFit Onboarding.dc.html).
    surface: '#FFFFFF',
    surfaceBorder: '#ECEBE4',
    track: '#F1EFE8',
    segmentSelected: '#FFFFFF',
    onSegmentSelected: '#16201A',
    ink: '#18211C',
    onInk: '#FFFFFF',
    // The dark "hero" stat card sits on Deep Kale in both themes.
    heroSurface: '#141E18',
    onHero: '#FFFFFF',
    onHeroMuted: '#9DB3A4',
    // Soft green info banner.
    tintSoft: '#E9F3EC',
    onTintSoft: '#235C3B',
    tintSoftBorder: '#CDE7D7',
    accentSoft: '#FDEEE8',
    // The macro trio (BatchFit Diary.dc.html food-detail ring): protein leads
    // in bright green, carbs take coral, fat takes gold — same in both themes.
    macroProtein: '#46C57E',
    macroCarbs: '#FB6E4E',
    macroFat: '#F5C84B',
    textMuted: '#9AA39C',
    // Thin progress track under the kcal budget card (Diary day log).
    barTrack: '#E3E0D8',
    // Coral-tinted border for low-stock batch cards (Prep inventory).
    lowBorder: '#F3D9CF',
    // The "per portion · updates live" panel in the batch wizard (mockup 1o).
    accentPanel: '#FFF3EF',
    accentPanelBorder: '#FBCBBC',
    onAccentPanel: '#B4705A',
    // Ring/bar track on the Today hero card, and the muted sparkline bars.
    heroTrack: '#26352B',
    sparkMuted: '#DCE6DF',
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
    surface: '#131E18',
    surfaceBorder: '#22332A',
    track: '#16241D',
    segmentSelected: '#46C57E',
    onSegmentSelected: '#0D1611',
    ink: '#EAF0EB',
    onInk: '#0D1611',
    heroSurface: '#16241D',
    onHero: '#F4F8F4',
    onHeroMuted: '#8FA396',
    tintSoft: '#16271D',
    onTintSoft: '#A8D8BC',
    tintSoftBorder: '#265237',
    accentSoft: 'rgba(251,110,78,0.16)',
    macroProtein: '#46C57E',
    macroCarbs: '#FB6E4E',
    macroFat: '#F5C84B',
    textMuted: '#6E8174',
    barTrack: '#0D1611',
    lowBorder: '#4A2E24',
    accentPanel: 'rgba(251,110,78,0.10)',
    accentPanelBorder: '#4A2E24',
    onAccentPanel: '#E8A48E',
    heroTrack: '#22332A',
    sparkMuted: '#2A4233',
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
