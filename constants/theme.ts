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

// ─── Colors ──────────────────────────────────────────────────────────────────
export const Colors = {
  // ── Backgrounds / surfaces ───────────────────────────────────────────────
  /** Primary screen background — slate-950 */
  background: '#0B1120',
  /** Card, header, banner background — slate-850 */
  surface: '#151E2F',
  /** Elevated surface (modals, pressed states) — slate-800 */
  surfaceElevated: '#1E293B',
  /** Borders, dividers, avatar placeholders — slate-700 */
  border: '#2A3649',
  /** Subtle border for inner dividers */
  borderSubtle: '#1E293B',

  // ── Accent ───────────────────────────────────────────────────────────────
  /** Brand electric-blue — blue-500 */
  accent: '#3B82F6',
  /** Lighter accent for badges, chips — blue-400 */
  accentLight: '#60A5FA',
  /** Accent at low opacity — glow behind CTAs */
  accentGlow: 'rgba(59,130,246,0.15)',
  /** Accent muted — for secondary accent elements */
  accentMuted: 'rgba(59,130,246,0.08)',

  // ── Text ─────────────────────────────────────────────────────────────────
  /** Primary text — slate-50 */
  textPrimary: '#F1F5F9',
  /** Secondary / muted text — slate-400 */
  textSecondary: '#94A3B8',
  /** Tertiary / inactive text — slate-500 */
  textTertiary: '#64748B',

  // ── Semantic ─────────────────────────────────────────────────────────────
  /** Destructive / error — red-500 */
  error: '#EF4444',
  /** Light error text on dark backgrounds — red-300 */
  errorLight: '#FCA5A5',
  /** Error banner background — very dark red */
  errorBackground: '#1C0A0A',
  /** Error banner border — red-900 */
  errorBorder: '#7F1D1D',
  /** Success — green-500 */
  success: '#22C55E',
  /** Warning — amber-500 */
  warning: '#F59E0B',

  // ── Base ─────────────────────────────────────────────────────────────────
  white: '#FFFFFF',
  /** CSS transparent — used for border-only shapes (e.g. pin tail triangle) */
  transparent: 'transparent',

  // ── Overlays (semi-transparent surfaces) ─────────────────────────────────
  /** Accent at low opacity — user location dot halo */
  accentSubtle: 'rgba(59,130,246,0.2)',
  /** Topbar pill / city banner background */
  overlayStrong: 'rgba(11,17,32,0.92)',
  /** Map city label background */
  overlayMedium: 'rgba(11,17,32,0.85)',
  /** Full-screen modal backdrop (e.g. deleting overlay) */
  modalBackdrop: 'rgba(0,0,0,0.7)',
} as const;

export type ColorKey = keyof typeof Colors;

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
  messageList: {
    dateHeader: {
      text: { color: '#E0E0E0' },
    },
    dateSeparator: {
      date: { color: '#E0E0E0' },
      container: { backgroundColor: 'transparent' },
    },
    inlineDateSeparator: {
      text: { color: '#E0E0E0' },
    },
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
