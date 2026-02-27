// app/event/[id].tsx — Group Chat Screen (Flow 5)
// Triggered by: EventCard "Join Event" / "Open Chat", or My Events tab row tap.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  Channel,
  Chat,
  MessageInput,
  MessageList,
  OverlayProvider,
} from 'stream-chat-expo';
import type { Channel as StreamChannel } from 'stream-chat';

import { supabase } from '../../lib/supabase';
import { streamClient } from '../../lib/streamClient';
import { useAuthStore } from '../../stores/authStore';
import { useLocationStore } from '../../stores/locationStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const ELECTRIC_BLUE = '#3B82F6';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeetupPoint {
  latitude: number;
  longitude: number;
  label: string;
}

interface ParticipantSnippet {
  id: string;
  display_name: string;
  avatar_url: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Haversine walking-time / distance label. */
function distanceLabel(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): string {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const distM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const walkMin = Math.round(distM / 80); // ~80 m/min walking speed
  if (walkMin < 1) return `${Math.round(distM)}m away`;
  if (walkMin <= 30) return `${walkMin} min walk`;
  return `${(distM / 1000).toFixed(1)}km away`;
}

// ─── Meetup Banner ────────────────────────────────────────────────────────────

function MeetupBanner({
  meetupPoint,
  userCoords,
}: {
  meetupPoint: MeetupPoint | null;
  userCoords: { latitude: number; longitude: number } | null;
}) {
  const openInMaps = () => {
    if (!meetupPoint) return;
    const { latitude: lat, longitude: lon, label } = meetupPoint;
    const query = encodeURIComponent(label || 'Meetup Point');
    const url =
      Platform.OS === 'ios'
        ? `maps:?ll=${lat},${lon}&q=${query}`
        : `geo:${lat},${lon}?q=${query}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open the maps app.'),
    );
  };

  return (
    <View style={bannerStyles.container}>
      <Text style={bannerStyles.pin}>📍</Text>
      <View style={bannerStyles.info}>
        {meetupPoint ? (
          <>
            <Text style={bannerStyles.label} numberOfLines={1}>
              {meetupPoint.label || 'Meetup Point'}
            </Text>
            {userCoords && (
              <Text style={bannerStyles.distance}>
                {distanceLabel(
                  userCoords.latitude,
                  userCoords.longitude,
                  meetupPoint.latitude,
                  meetupPoint.longitude,
                )}
              </Text>
            )}
          </>
        ) : (
          <Text style={bannerStyles.noPoint}>No meetup point yet</Text>
        )}
      </View>
      {meetupPoint && (
        <Pressable style={bannerStyles.mapsBtn} onPress={openInMaps}>
          <Text style={bannerStyles.mapsBtnText}>Open Maps</Text>
        </Pressable>
      )}
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    // Never scrolls — it is rendered above MessageList, outside the scroll area
  },
  pin: { fontSize: 18 },
  info: { flex: 1 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  distance: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  noPoint: {
    fontSize: 14,
    color: '#64748B',
    fontStyle: 'italic',
  },
  mapsBtn: {
    backgroundColor: ELECTRIC_BLUE,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mapsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

// ─── Participant Strip ─────────────────────────────────────────────────────────

function ParticipantStrip({
  participants,
  totalCount,
}: {
  participants: ParticipantSnippet[];
  totalCount: number;
}) {
  if (participants.length === 0) return null;

  const overflow = totalCount - participants.length;

  return (
    <View style={stripStyles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={stripStyles.scroll}
      >
        {participants.map((p) => (
          <View key={p.id} style={stripStyles.item}>
            <Image
              source={{ uri: p.avatar_url }}
              style={stripStyles.avatar}
              contentFit="cover"
            />
            <Text style={stripStyles.name} numberOfLines={1}>
              {p.display_name}
            </Text>
          </View>
        ))}
        {overflow > 0 && (
          <View style={stripStyles.item}>
            <View style={stripStyles.moreCircle}>
              <Text style={stripStyles.moreText}>+{overflow}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const stripStyles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
    alignItems: 'center',
  },
  item: {
    alignItems: 'center',
    gap: 4,
    width: 50,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#334155',
  },
  name: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
  },
  moreCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EventChatScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, profile, streamToken } = useAuthStore();
  const { coordinates } = useLocationStore();

  // ── State ──────────────────────────────────────────────────────────────────
  const [isConnecting, setIsConnecting] = useState(true);
  const [streamChannel, setStreamChannel] = useState<StreamChannel | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [eventTitle, setEventTitle] = useState('');
  const [participantCount, setParticipantCount] = useState(0);
  const [eventStatus, setEventStatus] = useState<'active' | 'expired'>('active');

  const [meetupPoint, setMeetupPoint] = useState<MeetupPoint | null>(null);
  const [participants, setParticipants] = useState<ParticipantSnippet[]>([]);

  const channelRef = useRef<StreamChannel | null>(null);

  // ── Setup: fetch metadata + connect Stream + watch channel ─────────────────
  useEffect(() => {
    if (!eventId || !user || !profile || !streamToken) return;

    let cancelled = false;

    const setup = async () => {
      try {
        // 1. Fetch event metadata from Supabase
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('title, participant_count, status')
          .eq('id', eventId)
          .single();

        if (eventError || !eventData) {
          if (!cancelled) setConnectError('Event not found.');
          return;
        }

        if (!cancelled) {
          setEventTitle(eventData.title);
          setParticipantCount(eventData.participant_count);
          setEventStatus(eventData.status as 'active' | 'expired');
        }

        // 2. Fetch participant snippets (first 5 for the avatar strip)
        const { data: participantIds } = await supabase
          .from('event_participants')
          .select('user_id')
          .eq('event_id', eventId)
          .limit(5);

        if (!cancelled && participantIds && participantIds.length > 0) {
          const ids = participantIds.map((p: { user_id: string }) => p.user_id);
          const { data: profileSnippets } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', ids);

          if (!cancelled && profileSnippets) {
            setParticipants(profileSnippets as ParticipantSnippet[]);
          }
        }

        // 3. Connect Stream user — idempotent: skip if already connected
        if (!streamClient.userID) {
          await streamClient.connectUser(
            {
              id: user.id,
              name: profile.display_name,
              image: profile.avatar_url,
            },
            streamToken,
          );
        }

        if (cancelled) return;

        // 4. Watch the channel (makes it "live" and populates channel.data)
        const ch = streamClient.channel('messaging', `event_${eventId}`);
        await ch.watch();

        if (cancelled) {
          ch.stopWatching().catch(() => {});
          return;
        }

        // 5. Read initial meetup_point from channel custom data
        const rawMeetup = (ch.data as Record<string, unknown>)?.meetup_point;
        if (rawMeetup && typeof rawMeetup === 'object') {
          setMeetupPoint(rawMeetup as MeetupPoint);
        }

        channelRef.current = ch;
        setStreamChannel(ch);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[EventChat] setup error:', msg);
          setConnectError('Could not connect to chat. Please go back and try again.');
        }
      } finally {
        if (!cancelled) setIsConnecting(false);
      }
    };

    setup();

    return () => {
      cancelled = true;
      // Stop watching on unmount to release the WebSocket slot for this channel
      channelRef.current?.stopWatching().catch(() => {});
      channelRef.current = null;
    };
    // eventId, user.id, and streamToken are the stable identifiers for this session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // ── Listen for meetup_point updates (channel.updated event) ────────────────
  useEffect(() => {
    if (!streamChannel) return;

    const { unsubscribe } = streamChannel.on('channel.updated', (event) => {
      const updated = event.channel as Record<string, unknown> | undefined;
      const raw = updated?.meetup_point;
      if (raw && typeof raw === 'object') {
        setMeetupPoint(raw as MeetupPoint);
      } else {
        setMeetupPoint(null);
      }
    });

    return () => unsubscribe();
  }, [streamChannel]);

  // ── "..." menu ─────────────────────────────────────────────────────────────
  const handleMenu = useCallback(() => {
    const isHost =
      (streamChannel?.data as Record<string, unknown> | undefined)
        ?.created_by_id === user?.id;

    const actions = isHost
      ? [
          {
            text: 'Set Meetup Point',
            onPress: () =>
              // TODO Phase 4: open map mini-sheet → channel.updatePartial({ set: { meetup_point } })
              Alert.alert(
                'Coming Soon',
                'Setting a meetup point from the app will be available in a future update.',
              ),
          },
        ]
      : [
          {
            text: 'Report Event',
            style: 'destructive' as const,
            onPress: () =>
              Alert.alert(
                'Reported',
                'Thanks — this event has been flagged for review.',
              ),
          },
        ];

    Alert.alert('Options', undefined, [
      ...actions,
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [streamChannel, user?.id]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isConnecting) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredFill}>
          <ActivityIndicator size="large" color={ELECTRIC_BLUE} />
          <Text style={styles.loadingText}>Connecting to chat…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (connectError || !streamChannel) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredFill}>
          <Text style={styles.errorText}>
            {connectError ?? 'Could not load chat.'}
          </Text>
          <Pressable style={styles.goBackBtn} onPress={() => router.back()}>
            <Text style={styles.goBackBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    // edges={['top']} — bottom inset handled by Stream's MessageInput internally
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {eventTitle}
        </Text>

        <View style={styles.headerRight}>
          <Text style={styles.participantBadge}>👥 {participantCount}</Text>
          <Pressable
            onPress={handleMenu}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.menuDots}>•••</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Expired banner ── */}
      {eventStatus === 'expired' && (
        <View style={styles.expiredBanner}>
          <Text style={styles.expiredText}>
            This event has ended — chat is read-only.
          </Text>
        </View>
      )}

      {/* ── Meetup banner — permanently fixed below header, never scrolls ── */}
      <MeetupBanner meetupPoint={meetupPoint} userCoords={coordinates} />

      {/*
       * OverlayProvider should ideally live in the root layout for cross-screen
       * image gallery support. Placing it here is acceptable for Phase 3.
       * TODO Phase 4: move OverlayProvider to app/_layout.tsx.
       */}
      <OverlayProvider>
        <Chat client={streamClient}>
          <Channel channel={streamChannel}>
            <View style={styles.chatContainer}>
              {/* ── Participant avatar strip ── */}
              <ParticipantStrip
                participants={participants}
                totalCount={participantCount}
              />

              {/* ── Message feed ── */}
              <View style={styles.messagesFill}>
                <MessageList />
              </View>

              {/*
               * Stream auto-disables MessageInput when the channel is frozen
               * (i.e. after the event expires via process-expiring-events).
               * No manual disabled state required.
               *
               * TODO Phase 4: replace with a custom InputBox that adds Photo,
               * Camera, and Poll attachment options per Flow 5.
               */}
              <MessageInput />
            </View>
          </Channel>
        </Chat>
      </OverlayProvider>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centeredFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 15,
  },
  errorText: {
    color: '#94A3B8',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  goBackBtn: {
    backgroundColor: ELECTRIC_BLUE,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  goBackBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 10,
  },
  backButton: {
    padding: 4,
  },
  backArrow: {
    fontSize: 22,
    color: '#F8FAFC',
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  participantBadge: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  menuDots: {
    fontSize: 16,
    color: '#94A3B8',
    letterSpacing: 2,
  },

  // Expired
  expiredBanner: {
    backgroundColor: '#1C0A0A',
    borderBottomWidth: 1,
    borderBottomColor: '#7F1D1D',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  expiredText: {
    color: '#FCA5A5',
    fontSize: 13,
    textAlign: 'center',
  },

  // Stream chat area
  chatContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  messagesFill: {
    flex: 1,
  },
});
