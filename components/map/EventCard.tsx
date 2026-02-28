// components/map/EventCard.tsx
// Animated bottom sheet that appears when a user taps an event pin.
// Props:
//   event     — Event | null. Setting to null triggers the slide-out animation.
//   onDismiss — Called after the slide-out animation completes.
//
// The component is ALWAYS mounted (sibling to MapView) and stays off-screen
// via translateY when no event is selected. This lets the slide-out animation
// complete before the parent clears state. pointerEvents="none" is applied
// when hidden so the map remains fully interactive.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { differenceInMinutes, formatDistanceToNow, isPast } from 'date-fns';

import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { Event, EventCategory } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ELECTRIC_BLUE = '#3B82F6';
// Generous height so the spring never shows the sheet background beneath it
const SHEET_HEIGHT = 520;

const CATEGORY_EMOJI: Record<EventCategory, string> = {
  beer: '🍺',
  food: '🍜',
  sightseeing: '🏛️',
  adventure: '🧗',
  culture: '🎭',
  other: '📍',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface HostProfile {
  display_name: string;
  avatar_url: string;
  verification_status: string;
}

interface ParticipantSnippet {
  id: string;
  avatar_url: string;
  display_name: string;
}

interface Props {
  event: Event | null;
  onDismiss: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countdownLabel(expiresAt: string): { label: string; color: string } {
  const exp = new Date(expiresAt);
  if (isPast(exp)) return { label: 'Expired', color: '#EF4444' };

  const minsLeft = differenceInMinutes(exp, new Date());
  const color =
    minsLeft < 30 ? '#EF4444' : minsLeft < 60 ? '#F59E0B' : '#22C55E';

  if (minsLeft < 60) return { label: `${minsLeft}m left`, color };

  const h = Math.floor(minsLeft / 60);
  const m = minsLeft % 60;
  if (minsLeft < 1440) {
    return { label: m > 0 ? `${h}h ${m}m` : `${h}h left`, color };
  }
  return { label: formatDistanceToNow(exp, { addSuffix: true }), color: '#22C55E' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventCard({ event, onDismiss }: Props) {
  const router = useRouter();
  const { user } = useAuthStore();

  // displayEvent persists the last seen event so the sheet content is still
  // visible while the slide-out animation plays.
  const [displayEvent, setDisplayEvent] = useState<Event | null>(null);
  const [host, setHost] = useState<HostProfile | null>(null);
  const [participants, setParticipants] = useState<ParticipantSnippet[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Refs — stable across re-renders
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Tracks the event ID that is currently visible (or being animated in)
  const currentEventIdRef = useRef<string | null>(null);

  // ── Animations ──────────────────────────────────────────────────────────────

  const slideIn = useCallback(() => {
    // Reset position instantly before springing in, so that switching between
    // events doesn't continue from wherever translateY currently sits.
    translateY.setValue(SHEET_HEIGHT);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 25,
        stiffness: 300,
        mass: 0.8,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0.55,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, backdropOpacity]);

  const slideOut = useCallback(
    (cb?: () => void) => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SHEET_HEIGHT,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          // Clear content only after animation is done so the sheet isn't blank
          // while sliding away.
          setDisplayEvent(null);
          setHost(null);
          setParticipants([]);
          setIsMember(false);
          currentEventIdRef.current = null;
          cb?.();
        }
      });
    },
    [translateY, backdropOpacity],
  );

  // ── React to event prop changes ──────────────────────────────────────────────

  useEffect(() => {
    // Event cleared externally (parent set selectedEvent to null while we
    // haven't dismissed via handleDismiss). Guard: if we already cleared it
    // (currentEventIdRef.current === null), do nothing.
    if (event === null) {
      if (currentEventIdRef.current !== null) {
        slideOut();
      }
      return;
    }

    // Same event — nothing to do (avoids re-animation on re-renders)
    if (event.id === currentEventIdRef.current) return;

    // ── New event selected ──
    currentEventIdRef.current = event.id;
    setDisplayEvent(event);
    setHost(null);
    setParticipants([]);
    setIsMember(false);
    setIsJoining(false);
    slideIn();

    // Fetch host profile + first 5 participant avatars
    let cancelled = false;

    (async () => {
      try {
        const [hostRes, partRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('display_name, avatar_url, verification_status')
            .eq('id', event.host_id)
            .single(),
          supabase
            .from('event_participants')
            .select('user_id')
            .eq('event_id', event.id)
            .limit(5),
        ]);

        if (cancelled) return;

        if (hostRes.data) setHost(hostRes.data as HostProfile);

        const partIds = (partRes.data ?? []).map(
          (p: { user_id: string }) => p.user_id,
        );

        // Check whether the signed-in user is already a member
        if (user?.id) {
          if (partIds.includes(user.id)) {
            if (!cancelled) setIsMember(true);
          } else {
            // User might be the 6th+ participant — do a targeted check
            const { data: memberRow } = await supabase
              .from('event_participants')
              .select('user_id')
              .eq('event_id', event.id)
              .eq('user_id', user.id)
              .maybeSingle();
            if (!cancelled) setIsMember(!!memberRow);
          }
        }

        // Fetch avatar + name for the participant strip
        if (partIds.length > 0) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, avatar_url, display_name')
            .in('id', partIds);

          if (!cancelled && profileData) {
            setParticipants(profileData as ParticipantSnippet[]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[EventCard] data fetch error:', err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // slideIn / slideOut are stable (useCallback with ref deps only).
    // displayEvent intentionally omitted — we use currentEventIdRef for ID tracking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, user?.id, slideIn, slideOut]);

  // ── Dismiss ──────────────────────────────────────────────────────────────────

  const handleDismiss = useCallback(() => {
    // Animate out, then notify parent. When the parent sets selectedEvent=null,
    // currentEventIdRef.current is already null so the useEffect is a no-op.
    slideOut(onDismiss);
  }, [slideOut, onDismiss]);

  // ── Join / Open Chat ─────────────────────────────────────────────────────────

  const handleJoinOrOpenChat = useCallback(async () => {
    if (!displayEvent || isJoining) return;

    const isHost = displayEvent.host_id === user?.id;

    // Already participating → open chat immediately
    if (isMember || isHost) {
      const targetId = displayEvent.id;
      slideOut(onDismiss);
      // Small delay so the slide-out starts before navigation
      setTimeout(() => router.push(`/event/${targetId}`), 300);
      return;
    }

    // ── Join flow ──
    setIsJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke('join-event', {
        body: { event_id: displayEvent.id },
      });

      if (error) throw error;

      if (data?.code === 'EVENT_EXPIRED') {
        Alert.alert('Event Ended', 'This event has already expired.');
        return;
      }

      if (data?.code === 'VERIFIED_ONLY') {
        Alert.alert(
          'Verified Travelers Only',
          'This event is only open to verified travelers. Get verified from your Profile tab.',
        );
        return;
      }

      // Success — user is now a member
      const targetId = displayEvent.id;
      setIsMember(true);
      slideOut(onDismiss);
      setTimeout(() => router.push(`/event/${targetId}`), 300);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to join. Please try again.',
      );
    } finally {
      setIsJoining(false);
    }
  }, [displayEvent, isJoining, isMember, user?.id, slideOut, onDismiss, router]);

  // ── Derived values ───────────────────────────────────────────────────────────

  const isHost = displayEvent?.host_id === user?.id;
  const { label: countdown, color: countdownColor } = displayEvent
    ? countdownLabel(displayEvent.expires_at)
    : { label: '', color: '#22C55E' };
  const overflow = displayEvent
    ? Math.max(0, displayEvent.participant_count - participants.length)
    : 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Dimming backdrop ── */}
      <Animated.View
        pointerEvents={displayEvent ? 'auto' : 'none'}
        style={[
          StyleSheet.absoluteFill,
          styles.backdrop,
          { opacity: backdropOpacity },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
      </Animated.View>

      {/* ── Bottom sheet ── */}
      <Animated.View
        pointerEvents={displayEvent ? 'auto' : 'none'}
        style={[styles.sheet, { transform: [{ translateY }] }]}
      >
        {displayEvent && (
          <>
            {/* Drag handle */}
            <View style={styles.handle} />

            {/* Category emoji + title */}
            <View style={styles.titleRow}>
              <Text style={styles.categoryEmoji}>
                {CATEGORY_EMOJI[displayEvent.category] ?? '📍'}
              </Text>
              <Text style={styles.title} numberOfLines={2}>
                {displayEvent.title}
              </Text>
            </View>

            {/* Countdown + metadata row */}
            <View style={styles.metaRow}>
              <View
                style={[
                  styles.countdownDot,
                  { backgroundColor: countdownColor },
                ]}
              />
              <Text style={[styles.countdown, { color: countdownColor }]}>
                {countdown}
              </Text>
              <Text style={styles.separator}>·</Text>
              <Text style={styles.discoveryLabel}>Discovery Area</Text>
              {displayEvent.verified_only && (
                <>
                  <Text style={styles.separator}>·</Text>
                  <Text style={styles.verifiedOnlyChip}>🛡️ Verified only</Text>
                </>
              )}
            </View>

            {/* Host row */}
            {host ? (
              <View style={styles.hostRow}>
                {host.avatar_url ? (
                  <Image
                    source={{ uri: host.avatar_url }}
                    style={styles.hostAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.hostAvatar, styles.avatarFallback]} />
                )}
                <View style={styles.hostTextBlock}>
                  <Text style={styles.hostedByLabel}>Hosted by</Text>
                  <Text style={styles.hostName}>{host.display_name}</Text>
                </View>
                {host.verification_status === 'verified' && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedBadgeText}>✓ Verified</Text>
                  </View>
                )}
              </View>
            ) : (
              // Skeleton while host loads
              <View style={styles.hostRowSkeleton} />
            )}

            {/* Participant strip */}
            <View style={styles.participantSection}>
              <Text style={styles.participantCountText}>
                {'👥 '}
                <Text style={styles.participantCountBold}>
                  {displayEvent.participant_count}
                </Text>
                {displayEvent.participant_count === 1
                  ? ' participant'
                  : ' participants'}
              </Text>

              {participants.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.avatarScroll}
                >
                  {participants.map((p) => (
                    <Image
                      key={p.id}
                      source={{ uri: p.avatar_url }}
                      style={styles.participantAvatar}
                      contentFit="cover"
                    />
                  ))}
                  {overflow > 0 && (
                    <View style={styles.overflowBubble}>
                      <Text style={styles.overflowText}>+{overflow}</Text>
                    </View>
                  )}
                </ScrollView>
              )}
            </View>

            {/* Meetup point (set via host action in Stream channel data — Phase 4) */}
            <View style={styles.meetupRow}>
              <Text style={styles.meetupPin}>📍</Text>
              <View>
                <Text style={styles.meetupLabel}>Official Meetup Point</Text>
                <Text style={styles.meetupValue}>Not decided yet</Text>
              </View>
            </View>

            {/* CTA */}
            <Pressable
              style={({ pressed }) => [
                styles.joinBtn,
                pressed && !isJoining && styles.joinBtnPressed,
                isJoining && styles.joinBtnLoading,
              ]}
              onPress={handleJoinOrOpenChat}
              disabled={isJoining}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.joinBtnText}>
                  {isMember || isHost ? 'Open Chat  →' : 'Join Event'}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </Animated.View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
