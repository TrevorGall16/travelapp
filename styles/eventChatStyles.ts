// styles/eventChatStyles.ts — Premium event chat screen styles

import { Platform, StyleSheet } from 'react-native';
import { Colors, Radius, Shadows, Spacing } from '../constants/theme';

// STREAM_THEME is centralized in constants/theme.ts
export { STREAM_THEME } from '../constants/theme';

// ─── MeetupBanner styles ────────────────────────────────────────────────────

export const bannerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm + 2,
    minHeight: 48,
    height: 48,
  },
  pin: { fontSize: 18 },
  info: { flex: 1 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  noPoint: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  noPointHint: {
    fontSize: 11,
    color: Colors.accent,
    marginTop: 2,
    fontWeight: '500',
  },
});

// ─── Main screen styles ─────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centeredFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.xxl,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  errorLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.error,
    textAlign: 'center',
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  goBackBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    ...Shadows.accentGlow,
  },
  goBackBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.sm + 2,
  },
  backButton: {
    padding: Spacing.xs,
  },
  backArrow: {
    fontSize: 22,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  participantBadge: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  menuDots: {
    fontSize: 16,
    color: Colors.textSecondary,
    letterSpacing: 2,
  },

  // ── Join bar ────────────────────────────────────────────────────────────
  joinBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  joinButton: {
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  joinButtonAccent: {
    backgroundColor: Colors.accent,
    ...Shadows.accentGlow,
  },
  joinButtonDisabled: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  joinButtonLoading: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  joinButtonTextMuted: {
    color: Colors.textTertiary,
    fontSize: 15,
    fontWeight: '600',
  },

  chatContainer: {
    flex: 1,
  },

  // ── Expired banner ──────────────────────────────────────────────────────
  expiredBanner: {
    backgroundColor: Colors.errorBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.errorBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  expiredText: {
    color: Colors.errorLight,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },

  // ── Deleting overlay ────────────────────────────────────────────────────
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.modalBackdrop,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
    zIndex: 100,
  },
  deletingText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Shared bottom-sheet chrome ──────────────────────────────────────────
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.modalBackdrop,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },

  // ── Options modal ───────────────────────────────────────────────────────
  optionsSheet: {
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
  optionRow: {
    paddingVertical: 17,
    alignItems: 'center',
  },
  optionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  optionDestructive: {
    color: Colors.error,
  },

  // ── Meetup KAV wrapper ──────────────────────────────────────────────────
  meetupKAV: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  // ── Delete confirm modal ────────────────────────────────────────────────
  deleteConfirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.modalBackdrop,
  },
  deleteConfirmCard: {
    position: 'absolute',
    left: Spacing.xxxl,
    right: Spacing.xxxl,
    top: '40%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xxl,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.heavy,
  },
  deleteConfirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  deleteConfirmBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  deleteConfirmActions: {
    flexDirection: 'row',
    gap: Spacing.sm + 2,
    marginTop: Spacing.xs,
  },
  deleteConfirmCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  deleteConfirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  deleteConfirmDeleteBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Radius.md,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  deleteConfirmDeleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },

  // ── Meetup point modal ──────────────────────────────────────────────────
  meetupSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  meetupSheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  meetupSheetSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: -4,
  },
  meetupInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: Spacing.md,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  meetupActions: {
    flexDirection: 'row',
    gap: Spacing.sm + 2,
    marginTop: Spacing.xs,
  },
  meetupCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  meetupCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  meetupConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    ...Shadows.accentGlow,
  },
  meetupConfirmBtnDisabled: {
    opacity: 0.5,
  },
  meetupConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },

  // ── Members modal ───────────────────────────────────────────────────────
  membersSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '70%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.md,
    paddingHorizontal: 0,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  membersTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  memberRowPressed: {
    backgroundColor: Colors.background,
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.border,
    flexShrink: 0,
  },
  memberAvatarFallback: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarEmoji: {
    fontSize: 18,
  },
  memberName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  hostBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentMuted,
    borderWidth: 1,
    borderColor: Colors.accentGlow,
  },
  hostBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 0.3,
  },
});
