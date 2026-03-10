// styles/mapScreenStyles.ts — Premium map screen styles

import { Platform, StyleSheet } from 'react-native';
import { Colors, Radius, Shadows, Spacing } from '../constants/theme';

export const styles = StyleSheet.create({
  fill: { flex: 1 },
  centeredFill: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl, gap: Spacing.lg, backgroundColor: Colors.background },
  mapContainer: { flex: 1, backgroundColor: 'red' },  // TODO: remove red debug bg once tiles confirmed
  mapAbsoluteFill: { ...StyleSheet.absoluteFillObject },
  map: { flex: 1 },

  // Map header bar
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    zIndex: 20,
  },
  mapHeaderSpacer: {
    flex: 1,
  },
  appName: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
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
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: Colors.white,
    ...Shadows.medium,
  },
  clusterCount: {
    color: Colors.white,
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
    borderColor: Colors.accent,
    padding: 2,
  },
  pinBody: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: Colors.white,
    ...Shadows.medium,
  },
  pinEmoji: { fontSize: 22 },

  // Empty state
  emptyBanner: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: Colors.overlayStrong,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  emptyText: {
    color: Colors.textSecondary,
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.accentGlow,
  },

  // Permission denied overlay
  permissionIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accentGlow,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  permissionTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  permissionText: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 260,
  },
  permissionBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
    ...Shadows.accentGlow,
  },
  permissionBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  permissionSettingsLink: {
    color: Colors.textTertiary,
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
    backgroundColor: Colors.accentSubtle,
  },
  userDotOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.accentSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accent,
    borderWidth: 2.5,
    borderColor: Colors.white,
  },

  // ── Filter / Stacked Modal ──────────────────────────────────────────
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.modalBackdrop,
  },
  filterSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  filterHandle: {
    width: 40,
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textTertiary,
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
    borderTopColor: Colors.border,
  },
  filterRowActive: {},
  filterRowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  filterRowLabelActive: {
    color: Colors.accent,
    fontWeight: '600',
  },

  // ── List View rows ────────────────────────────────────────────────
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
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
    color: Colors.textPrimary,
  },
  listRowMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
