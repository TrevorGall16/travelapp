// styles/mapScreenStyles.ts — Premium map screen styles

import { Platform, StyleSheet } from 'react-native';
import type { ThemeColors } from '../constants/theme';
import { Radius, Shadows, Spacing } from '../constants/theme';

export const createStyles = (colors: ThemeColors) => StyleSheet.create({
  fill: { flex: 1 },
  centeredFill: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl, gap: Spacing.lg, backgroundColor: colors.background },
  mapContainer: { flex: 1 },
  map: { flex: 1 },

  // Map header bar
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    zIndex: 20,
  },
  mapHeaderSpacer: {
    flex: 1,
  },
  appName: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  mapHeaderActions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },

  // Cluster bubble — premium ring + shadow
  clusterMarker: {
    backgroundColor: colors.accent,
    borderRadius: Radius.full,
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: colors.white,
    ...Shadows.medium,
  },
  clusterCount: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },

  // Individual pin — avatar-circle style (no tail, white ring)
  pinContainer: {
    alignItems: 'center',
  },
  pinVerifiedRing: {
    borderRadius: 30,
    borderWidth: 2.5,
    borderColor: colors.accent,
    padding: 2,
  },
  pinBody: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: colors.white,
    ...Shadows.medium,
  },
  pinEmoji: { fontSize: 22 },

  // Empty state
  emptyBanner: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: colors.overlayStrong,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.card,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Recenter FAB
  recenterFab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 188 : 168,
    right: 20,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.medium,
  },

  // Create FAB
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 116 : 96,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.accentGlow,
  },

  // Permission denied overlay
  permissionIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentGlow,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  permissionTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  permissionText: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 260,
  },
  permissionBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
    ...Shadows.accentGlow,
  },
  permissionBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  permissionSettingsLink: {
    color: colors.textTertiary,
    fontSize: 14,
    fontWeight: '500',
    marginTop: Spacing.md,
  },

  // Custom user location dot with sonar pulse
  userDotContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDotPulse: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSubtle,
  },
  userDotOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    borderWidth: 2.5,
    borderColor: colors.white,
  },

  // ── Filter / Stacked Modal ──────────────────────────────────────────
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.modalBackdrop,
  },
  filterSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  filterHandle: {
    width: 40,
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  filterRowActive: {},
  filterRowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  filterRowLabelActive: {
    color: colors.accent,
    fontWeight: '600',
  },

  // ── List View rows ────────────────────────────────────────────────
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: Spacing.md,
  },
  listRowEmoji: {
    fontSize: 24,
    width: 36,
    textAlign: 'center',
  },
  listRowContent: {
    flex: 1,
  },
  listRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  listRowMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
