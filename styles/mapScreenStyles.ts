// styles/mapScreenStyles.ts — Styles extracted from app/(tabs)/index.tsx

import { Platform, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';

export const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: Colors.background },
  centeredFill: { justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  map: { flex: 1 },

  // Map header bar
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  mapHeaderActions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 8,
  },

  // Cluster bubble
  clusterMarker: {
    backgroundColor: Colors.accent,
    borderRadius: 24,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
    shadowColor: Colors.background,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  clusterCount: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },

  // Individual pin (teardrop: circle body + triangular tail)
  pinContainer: {
    alignItems: 'center',
  },
  pinVerifiedRing: {
    borderRadius: 28,
    borderWidth: 2.5,
    borderColor: Colors.accent,
    padding: 2,
  },
  pinBody: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.background,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  pinEmoji: { fontSize: 22 },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: Colors.transparent,
    borderRightColor: Colors.transparent,
    borderTopColor: Colors.surface,
    marginTop: -1,
  },

  // Empty state — sits just below the map header, well above the FAB
  emptyBanner: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: Colors.overlayStrong,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },

  // Recenter FAB — sits above the create FAB
  recenterFab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 188 : 168,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.background,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },

  // Create FAB — z-index: rendered conditionally (hidden when EventCard sheet is open)
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
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },

  // Permission denied
  permissionText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 26,
  },
  permissionBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // Custom user location dot (replaces native showsUserLocation)
  userDotOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accentSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.white,
  },

  // ── Filter Modal ──────────────────────────────────────────────
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  filterSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  filterHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  filterRowActive: {
    // No background change — checkmark + accent text convey selection
  },
  filterRowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  filterRowLabelActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
});
