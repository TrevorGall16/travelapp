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

import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { countdownLabel } from '../../lib/eventFormatters';
import { styles, SHEET_HEIGHT } from '../../styles/eventCardStyles';
import type { Event, EventCategory } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

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
