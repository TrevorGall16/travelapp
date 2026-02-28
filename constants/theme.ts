/**
 * Global design tokens for NomadMeet.
 * All component files must import colours from here.
 * No raw hex codes are permitted inside component or screen files.
 */

export const Colors = {
  // ── Backgrounds / surfaces ───────────────────────────────────────────────
  /** Primary screen background — slate-950 */
  background: '#0F172A',
  /** Card, header, banner background — slate-800 */
  surface: '#1E293B',
  /** Borders, dividers, avatar placeholders — slate-700 */
  border: '#334155',

  // ── Accent ───────────────────────────────────────────────────────────────
  /** Brand electric-blue — blue-500 */
  accent: '#3B82F6',

  // ── Text ─────────────────────────────────────────────────────────────────
  /** Primary text — slate-50 */
  textPrimary: '#F8FAFC',
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

  // ── Base ─────────────────────────────────────────────────────────────────
  white: '#FFFFFF',
  /** CSS transparent — used for border-only shapes (e.g. pin tail triangle) */
  transparent: 'transparent',

  // ── Overlays (semi-transparent surfaces) ─────────────────────────────────
  /** Accent at low opacity — user location dot halo */
  accentSubtle: 'rgba(59,130,246,0.2)',
  /** Topbar pill / city banner background */
  overlayStrong: 'rgba(15,23,42,0.9)',
  /** Map city label background */
  overlayMedium: 'rgba(15,23,42,0.85)',
  /** Full-screen modal backdrop (e.g. deleting overlay) */
  modalBackdrop: 'rgba(0,0,0,0.65)',
} as const;

export type ColorKey = keyof typeof Colors;
