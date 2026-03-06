// styles/eventCardStyles.ts — Premium event card bottom sheet

import { Platform, StyleSheet } from 'react-native';
import { Colors, Radius, Shadows, Spacing } from '../constants/theme';

// Generous height so the spring never shows the sheet background beneath it.
export const SHEET_HEIGHT = 540;

export const styles = StyleSheet.create({
  // Backdrop
  backdrop: {
    backgroundColor: '#000000',
  },

  // Sheet
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 40 : 32,
    minHeight: 220,
    borderTopWidth: 1,
    borderColor: Colors.border,
    ...Shadows.heavy,
  },

  // Drag handle
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
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
    color: Colors.textPrimary,
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
    color: Colors.border,
  },
  discoveryLabel: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  verifiedOnlyChip: {
    fontSize: 12,
    color: Colors.accentLight,
    fontWeight: '600',
    backgroundColor: Colors.accentMuted,
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
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hostRowSkeleton: {
    height: 60,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    marginBottom: Spacing.md,
  },
  hostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.border,
  },
  avatarFallback: {
    backgroundColor: Colors.surfaceElevated,
  },
  hostTextBlock: {
    flex: 1,
    gap: 1,
  },
  hostedByLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hostName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  verifiedBadge: {
    backgroundColor: Colors.accentMuted,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.accentGlow,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accentLight,
  },

  // Participants
  participantSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  participantCountText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  participantCountBold: {
    fontWeight: '700',
    color: Colors.textPrimary,
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
    backgroundColor: Colors.border,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  overflowBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 2,
    borderColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overflowText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },

  // Meetup point — premium nested card
  meetupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  meetupPin: { fontSize: 18 },
  meetupLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  meetupValue: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // CTA button — premium with accent glow
  joinBtn: {
    backgroundColor: Colors.accent,
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
    color: Colors.white,
    letterSpacing: 0.3,
  },
});
