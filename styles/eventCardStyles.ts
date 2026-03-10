// styles/eventCardStyles.ts — Premium event card bottom sheet

import { Platform, StyleSheet } from 'react-native';
import type { ThemeColors } from '../constants/theme';
import { Radius, Shadows, Spacing } from '../constants/theme';

// Generous height so the spring never shows the sheet background beneath it.
export const SHEET_HEIGHT = 540;

export const createStyles = (colors: ThemeColors) => StyleSheet.create({
  // Backdrop
  backdrop: {
    backgroundColor: '#000000',
  },

  // Sheet — semi-transparent to let BlurView show through
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(21,30,47,0.65)',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    minHeight: 220,
    borderTopWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...Shadows.heavy,
  },
  blurFill: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 40 : 32,
  },

  // Drag handle
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: Spacing.lg,
  },

  // Title
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  categoryEmoji: {
    fontSize: 28,
    marginTop: 2,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 28,
    letterSpacing: -0.3,
  },

  // Meta row (countdown + tags)
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  countdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  countdown: {
    fontSize: 13,
    fontWeight: '700',
  },
  separator: {
    fontSize: 13,
    color: colors.border,
  },
  discoveryLabel: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  verifiedOnlyChip: {
    fontSize: 12,
    color: colors.accentLight,
    fontWeight: '600',
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },

  // Host — premium card-in-card
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: colors.background,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hostRowSkeleton: {
    height: 60,
    borderRadius: Radius.md,
    backgroundColor: colors.background,
    marginBottom: Spacing.md,
  },
  hostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
  },
  avatarFallback: {
    backgroundColor: colors.surfaceElevated,
  },
  hostTextBlock: {
    flex: 1,
    gap: 1,
  },
  hostedByLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hostName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  verifiedBadge: {
    backgroundColor: colors.accentMuted,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.accentGlow,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentLight,
  },

  // Participants
  participantSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  participantCountText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  participantCountBold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  avatarScroll: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingVertical: 2,
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.border,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  overflowBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overflowText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  // Meetup point — premium nested card
  meetupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: colors.background,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  meetupPin: { fontSize: 18 },
  meetupLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  meetupValue: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // CTA button — premium with accent glow
  joinBtn: {
    backgroundColor: colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.accentGlow,
  },
  joinBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  joinBtnLoading: {
    opacity: 0.7,
  },
  joinBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.3,
  },
});
