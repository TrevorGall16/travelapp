/**
 * Global design tokens for NomadMeet.
 * All component files must import colours from here.
 * No raw hex codes are permitted inside component or screen files.
 */

// ─── Spacing Scale ───────────────────────────────────────────────────────────
export const Spacing = {
  /** 4px */  xs: 4,
  /** 8px */  sm: 8,
  /** 12px */ md: 12,
  /** 16px */ lg: 16,
  /** 20px */ xl: 20,
  /** 24px */ xxl: 24,
  /** 32px */ xxxl: 32,
} as const;

// ─── Border Radius Scale ─────────────────────────────────────────────────────
export const Radius = {
  /** 8px  — small chips, badges */  sm: 8,
  /** 12px — cards, inputs */        md: 12,
  /** 16px — large cards, sheets */  lg: 16,
  /** 20px — bottom sheets */        xl: 20,
  /** 9999 — pills, full-round */    full: 9999,
} as const;

// ─── Color Palettes ─────────────────────────────────────────────────────────

/** Dark palette — current default (slate-based) */
export const DarkColors = {
  // ── Backgrounds / surfaces ───────────────────────────────────────────────
  background: '#0B1120',
  surface: '#151E2F',
  surfaceElevated: '#1E293B',
  border: '#2A3649',
  borderSubtle: '#1E293B',

  // ── Accent ───────────────────────────────────────────────────────────────
  accent: '#3B82F6',
  accentLight: '#60A5FA',
  accentGlow: 'rgba(59,130,246,0.15)',
  accentMuted: 'rgba(59,130,246,0.08)',

  // ── Text ─────────────────────────────────────────────────────────────────
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',

  // ── Semantic ─────────────────────────────────────────────────────────────
  error: '#EF4444',
  errorLight: '#FCA5A5',
  errorBackground: '#1C0A0A',
  errorBorder: '#7F1D1D',
  success: '#22C55E',
  warning: '#F59E0B',

  // ── Base ─────────────────────────────────────────────────────────────────
  white: '#FFFFFF',
  transparent: 'transparent',

  // ── Overlays ─────────────────────────────────────────────────────────────
  accentSubtle: 'rgba(59,130,246,0.2)',
  overlayStrong: 'rgba(11,17,32,0.92)',
  overlayMedium: 'rgba(11,17,32,0.85)',
  modalBackdrop: 'rgba(0,0,0,0.7)',
} as const;

/** Light palette — slate-50 / white based */
export const LightColors = {
  // ── Backgrounds / surfaces ───────────────────────────────────────────────
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F9',
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',

  // ── Accent ───────────────────────────────────────────────────────────────
  accent: '#2563EB',
  accentLight: '#3B82F6',
  accentGlow: 'rgba(37,99,235,0.12)',
  accentMuted: 'rgba(37,99,235,0.06)',

  // ── Text ─────────────────────────────────────────────────────────────────
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',

  // ── Semantic ─────────────────────────────────────────────────────────────
  error: '#DC2626',
  errorLight: '#EF4444',
  errorBackground: '#FEF2F2',
  errorBorder: '#FECACA',
  success: '#16A34A',
  warning: '#D97706',

  // ── Base ─────────────────────────────────────────────────────────────────
  white: '#FFFFFF',
  transparent: 'transparent',

  // ── Overlays ─────────────────────────────────────────────────────────────
  accentSubtle: 'rgba(37,99,235,0.15)',
  overlayStrong: 'rgba(248,250,252,0.95)',
  overlayMedium: 'rgba(248,250,252,0.9)',
  modalBackdrop: 'rgba(0,0,0,0.5)',
} as const;

/** Returns the palette for a given color scheme. */
export function getColors(scheme: 'light' | 'dark'): typeof DarkColors {
  return scheme === 'light' ? LightColors : DarkColors;
}

// ── Active Colors export — defaults to dark, updated at runtime by root layout.
// All existing StyleSheet.create calls reference this object.
// When light mode is enabled, root layout calls `setColorScheme('light')` which
// mutates these values in-place so static stylesheets pick them up on next render.
export const Colors: Record<keyof typeof DarkColors, string> = { ...DarkColors };

/** Call from root layout to switch the active palette at runtime. */
export function setColorScheme(scheme: 'light' | 'dark') {
  const palette = getColors(scheme);
  for (const key of Object.keys(palette) as Array<keyof typeof DarkColors>) {
    (Colors as Record<string, string>)[key] = palette[key];
  }
}

export type ColorKey = keyof typeof DarkColors;

// ─── Shadow Presets ──────────────────────────────────────────────────────────
// Platform-aware shadow helpers for consistent elevation.
import { Platform } from 'react-native';

export const Shadows = {
  /** Subtle card shadow */
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
  }),
  /** Medium elevation — FABs, sheets */
  medium: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
    },
    android: { elevation: 8 },
  }),
  /** Heavy elevation — modals, overlays */
  heavy: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
    },
    android: { elevation: 16 },
  }),
  /** Accent glow — CTA buttons */
  accentGlow: Platform.select({
    ios: {
      shadowColor: '#3B82F6',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
    },
    android: { elevation: 8 },
  }),
} as const;

// ─── Stream Chat Dark Theme (unified) ────────────────────────────────────────
// Used by both the channel list (chats.tsx) and the chat screen ([id].tsx).

export const STREAM_THEME = {
  colors: {
    white: Colors.surface,
    white_snow: Colors.background,
    bg_gradient_start: Colors.background,
    bg_gradient_end: Colors.background,
    grey_gainsboro: Colors.border,
    grey_whisper: Colors.surface,
    grey: Colors.textSecondary,
    grey_dark: Colors.textSecondary,
    black: Colors.textPrimary,
    blue_alice: Colors.accent,
    accent_blue: Colors.accent,
    targetedMessageBackground: Colors.border,
  },
  messageSimple: {
    content: {
      markdown: {
        text: { color: Colors.textPrimary },
        em: { color: Colors.textPrimary },
        strong: { color: Colors.textPrimary },
        link: { color: Colors.accent },
      },
      containerInner: {
        backgroundColor: Colors.surface,
      },
    },
  },

  dateHeader: {
    text: { color: '#E0E0E0' },
  },
  inlineDateSeparator: {
    text: { color: '#E0E0E0' },
  },
  messageInput: {
    container: {
      backgroundColor: Colors.surface,
      borderTopColor: Colors.border,
      borderTopWidth: 1,
      paddingHorizontal: 8,
      // ── Nuclear Zero: no internal spacing that can drift on keyboard dismiss ──
      paddingVertical: 0,
      paddingBottom: 0,
      paddingTop: 0,
      marginBottom: 0,
      marginTop: 0,
    },
    inputBoxContainer: {
      backgroundColor: Colors.background,
      borderColor: Colors.border,
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 12,
    },
    inputBox: {
      color: Colors.textPrimary,
      fontSize: 15,
    },
    sendButton: {
      backgroundColor: Colors.accent,
      borderRadius: 20,
      width: 34,
      height: 34,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    sendButtonContainer: {
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      paddingLeft: 8,
    },
  },
};
