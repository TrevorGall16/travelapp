// styles/eventCardStyles.ts — Styles extracted from components/map/EventCard.tsx

import { StyleSheet } from 'react-native';

// Generous height so the spring never shows the sheet background beneath it.
// Exported because the component's animation logic references this value directly.
export const SHEET_HEIGHT = 520;

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
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36, // approx. safe-area bottom on most devices
    minHeight: 200,
    // Elevation so it sits above map markers on Android
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },

  // Drag handle
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#475569',
    marginBottom: 16,
  },

  // Title
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  categoryEmoji: {
    fontSize: 26,
    marginTop: 1,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    lineHeight: 26,
  },

  // Meta row (countdown + tags)
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
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
    color: '#475569',
  },
  discoveryLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  verifiedOnlyChip: {
    fontSize: 12,
    color: '#60A5FA',
    fontWeight: '600',
  },

  // Host
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  hostRowSkeleton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    marginBottom: 14,
  },
  hostAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
  },
  avatarFallback: {
    backgroundColor: '#475569',
  },
  hostTextBlock: {
    flex: 1,
  },
  hostedByLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  hostName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  verifiedBadge: {
    backgroundColor: '#1D3461',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#60A5FA',
  },

  // Participants
  participantSection: {
    gap: 8,
    marginBottom: 14,
  },
  participantCountText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  participantCountBold: {
    fontWeight: '700',
    color: '#F8FAFC',
  },
  avatarScroll: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    borderWidth: 1.5,
    borderColor: '#1E293B',
  },
  overflowBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overflowText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },

  // Meetup point
  meetupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  meetupPin: { fontSize: 16 },
  meetupLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  meetupValue: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 1,
  },

  // CTA button
  joinBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  joinBtnPressed: {
    opacity: 0.85,
  },
  joinBtnLoading: {
    opacity: 0.7,
  },
  joinBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
