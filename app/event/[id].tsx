// app/event/[id].tsx — Group Chat Screen (Flow 5)
// Triggered by: EventCard "Join Event" / "Open Chat", or My Events tab row tap.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { Colors } from '../../constants/theme';

// ─── Stream dark theme ────────────────────────────────────────────────────────

const STREAM_THEME = {
  colors: {
    white_snow: Colors.background,
    white: Colors.surface,
    black: Colors.textPrimary,
    grey: Colors.textSecondary,
    grey_gainsboro: Colors.border,
    grey_whisper: Colors.surface,
    bg_gradient_start: Colors.background,
    bg_gradient_end: Colors.background,
  },
};

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
  isHost,
  onSetMeetupPoint,
}: {
  meetupPoint: MeetupPoint | null;
  userCoords: { latitude: number; longitude: number } | null;
  isHost?: boolean;
  onSetMeetupPoint?: () => void;
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
        ) : isHost ? (
          <TouchableOpacity onPress={onSetMeetupPoint} activeOpacity={0.7}>
            <Text style={bannerStyles.noPoint}>No meetup point yet</Text>
            <Text style={bannerStyles.noPointHint}>Tap to set one</Text>
          </TouchableOpacity>
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
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  pin: { fontSize: 18 },
  info: { flex: 1 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  distance: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
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
  },
  mapsBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mapsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
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
  const router = useRouter();

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
          <TouchableOpacity
            key={p.id}
            style={stripStyles.item}
            onPress={() => router.push(`/user/${p.id}`)}
            activeOpacity={0.7}
          >
            <Image
              source={{ uri: p.avatar_url }}
              style={stripStyles.avatar}
              contentFit="cover"
            />
            <Text style={stripStyles.name} numberOfLines={1}>
              {p.display_name}
            </Text>
          </TouchableOpacity>
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
    borderBottomColor: Colors.surface,
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
    backgroundColor: Colors.border,
  },
  name: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  moreCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EventChatScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, streamToken } = useAuthStore();
  const { coordinates } = useLocationStore();

  // ── State ──────────────────────────────────────────────────────────────────
  const [isConnecting, setIsConnecting] = useState(true);
  const [streamChannel, setStreamChannel] = useState<StreamChannel | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [eventTitle, setEventTitle] = useState('');
  const [participantCount, setParticipantCount] = useState(0);
  const [eventStatus, setEventStatus] = useState<'active' | 'expired'>('active');
  const [eventHostId, setEventHostId] = useState<string | null>(null);

  const [meetupPoint, setMeetupPoint] = useState<MeetupPoint | null>(null);
  const [participants, setParticipants] = useState<ParticipantSnippet[]>([]);

  // Meetup input modal (Android fallback — iOS uses Alert.prompt)
  const [meetupModalVisible, setMeetupModalVisible] = useState(false);
  const [meetupDraft, setMeetupDraft] = useState('');
  const [isSettingMeetup, setIsSettingMeetup] = useState(false);

  // isDeleting: locks the UI during the delete-event Edge Function call
  const [isDeleting, setIsDeleting] = useState(false);

  const channelRef = useRef<StreamChannel | null>(null);

  // ── 5-second timeout: surface the error instead of spinning forever ────────
  useEffect(() => {
    if (!isConnecting) return;
    const t = setTimeout(() => {
      setIsConnecting(false);
      setConnectError(
        streamToken
          ? 'Connection timed out. Check your Stream API key and network.'
          : 'Stream token is missing. Check that generate-stream-token deployed correctly and STREAM_SECRET_KEY is set in Supabase secrets.',
      );
    }, 5_000);
    return () => clearTimeout(t);
  }, [isConnecting, streamToken]);

  // ── Setup: fetch metadata + connect Stream + watch channel ─────────────────
  useEffect(() => {
    if (!eventId || !user || !profile) return;
    if (!streamToken) {
      console.warn('[EventChat] streamToken is null — cannot connect. eventId:', eventId,
        '| user:', user.id, '| profile.display_name:', profile.display_name);
      setConnectError('Stream token is missing. Sign out and back in, or check that generate-stream-token is deployed.');
      setIsConnecting(false);
      return;
    }

    if (streamChannel) return;

    let cancelled = false;

    const setup = async () => {
      console.log('[EventChat] setup() start → eventId:', eventId, '| userID:', user.id);
      try {
        // 1. Fetch event metadata
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('title, participant_count, status, host_id')
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
          setEventHostId(eventData.host_id ?? null);
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
          console.error('[EventChat] setup() threw:', msg);
          setConnectError(`Chat error: ${msg}`);
        }
      } finally {
        if (!cancelled) setIsConnecting(false);
      }
    };

    setup();

    return () => {
      cancelled = true;
      channelRef.current?.stopWatching().catch(() => {});
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, streamToken]);

  // ── Listen for meetup_point updates ────────────────────────────────────────
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

  // ── Set meetup point (host only) ────────────────────────────────────────────

  const saveMeetupPoint = useCallback(
    async (label: string) => {
      const trimmed = label.trim();
      if (!trimmed || !streamChannel) return;
      setIsSettingMeetup(true);
      try {
        // Persist to Stream channel custom data — the channel.updated listener
        // will pick this up and refresh the banner automatically.
        await streamChannel.updatePartial({
          set: { meetup_point: { latitude: 0, longitude: 0, label: trimmed } },
        });
        // DB persistence — requires migration:
        // ALTER TABLE events ADD COLUMN meetup_point_label TEXT;
        await supabase
          .from('events')
          .update({ meetup_point_label: trimmed })
          .eq('id', eventId);
      } catch (err) {
        Alert.alert('Error', 'Could not save meetup point. Please try again.');
      } finally {
        setIsSettingMeetup(false);
        setMeetupModalVisible(false);
      }
    },
    [streamChannel, eventId],
  );

  const handleSetMeetupPoint = useCallback(() => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Set Meetup Point',
        'Enter a short description of where to meet.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Set',
            onPress: (text) => {
              if (text) saveMeetupPoint(text);
            },
          },
        ],
        'plain-text',
        meetupPoint?.label ?? '',
      );
    } else {
      setMeetupDraft(meetupPoint?.label ?? '');
      setMeetupModalVisible(true);
    }
  }, [meetupPoint, saveMeetupPoint]);

  // ── Delete event (host only) ────────────────────────────────────────────────
  // Architecture: all event deletions go through the delete-event Edge Function,
  // which syncs Stream.io before removing the DB row. Client never writes DELETE.
  const handleDeleteEvent = useCallback(() => {
    Alert.alert(
      'Delete Event',
      'This will permanently delete the event and remove all members from the chat. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const { error } = await supabase.functions.invoke('delete-event', {
                body: { event_id: eventId },
              });
              if (error) {
                throw new Error(error.message ?? 'Delete failed.');
              }
              // Success: navigate back to the map root
              router.replace('/(tabs)/');
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Could not delete the event.';
              console.error('[EventChat] delete-event error:', msg);
              Alert.alert('Error', msg);
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  }, [eventId, router]);

  // ── "..." menu ─────────────────────────────────────────────────────────────
  const handleMenu = useCallback(() => {
    const isHost = user?.id === eventHostId;

    const actions = isHost
      ? [
          {
            text: 'Edit Meetup Point',
            onPress: handleSetMeetupPoint,
          },
          {
            text: 'Delete Event',
            style: 'destructive' as const,
            onPress: handleDeleteEvent,
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
  }, [user?.id, eventHostId, handleSetMeetupPoint, handleDeleteEvent]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isConnecting) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredFill}>
          <ActivityIndicator size="large" color={Colors.accent} />
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
          <Text style={styles.errorLabel}>⚠️ Connection Failed</Text>
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
  //
  // Layout contract:
  //   SafeAreaView edges={['top']} — handles status bar only.
  //   KeyboardAvoidingView (behavior='padding' iOS) wraps the chat tree so the
  //   software keyboard doesn't cover the MessageInput. The `keyboardVerticalOffset`
  //   is set to `insets.bottom` so it accounts for the gesture nav bar height.
  //   Stream's Channel also receives keyboardVerticalOffset for its internal handler.
  //
  //   chatContainer (flex: 1) inside Channel:
  //     → column: ParticipantStrip (natural) | messagesFill (flex:1) | MessageInput
  //
  return (
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
            disabled={isDeleting}
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
      <MeetupBanner
        meetupPoint={meetupPoint}
        userCoords={coordinates}
        isHost={user?.id === eventHostId}
        onSetMeetupPoint={handleSetMeetupPoint}
      />

      {/*
       * chatWrapper gives the Stream component tree a bounded flex region.
       * OverlayProvider, Chat, and Channel are context/keyboard providers —
       * they do not self-size. Without this wrapper they collapse to 0 height,
       * which is why MessageInput was invisible.
       *
       * TODO Phase 4: move OverlayProvider to app/_layout.tsx.
       */}
      <KeyboardAvoidingView
        style={styles.chatWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.bottom}
      >
        <OverlayProvider>
          <Chat client={streamClient} style={STREAM_THEME}>
            <Channel
              channel={streamChannel}
              keyboardVerticalOffset={insets.bottom}
            >
              <View style={styles.chatContainer}>

                {/* ── Participant avatar strip — fixed height row ── */}
                <ParticipantStrip
                  participants={participants}
                  totalCount={participantCount}
                />

                {/* ── Message feed — fills remaining vertical space ── */}
                <View style={styles.messagesFill}>
                  <MessageList noGroupByUser />
                </View>

                {/* ── Message input ── TODO Phase 4: replace with custom InputBox */}
                <MessageInput />

              </View>
            </Channel>
          </Chat>
        </OverlayProvider>
      </KeyboardAvoidingView>

      {/* ── Deleting overlay — blocks UI while delete-event Edge Function runs ── */}
      {isDeleting && (
        <View style={styles.deletingOverlay}>
          <ActivityIndicator size="large" color={Colors.white} />
          <Text style={styles.deletingText}>Deleting event…</Text>
        </View>
      )}

      {/* ── Meetup point input modal (Android + universal fallback) ── */}
      <Modal
        visible={meetupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMeetupModalVisible(false)}
      >
        <Pressable
          style={styles.meetupOverlay}
          onPress={() => setMeetupModalVisible(false)}
        />
        <View style={[styles.meetupSheet, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.meetupSheetTitle}>Set Meetup Point</Text>
          <Text style={styles.meetupSheetSubtitle}>
            Describe where the group should meet up.
          </Text>
          <TextInput
            style={styles.meetupInput}
            value={meetupDraft}
            onChangeText={setMeetupDraft}
            placeholder="e.g. Front entrance of the café"
            placeholderTextColor={Colors.textTertiary}
            maxLength={100}
            autoFocus
          />
          <View style={styles.meetupActions}>
            <Pressable
              style={styles.meetupCancelBtn}
              onPress={() => setMeetupModalVisible(false)}
            >
              <Text style={styles.meetupCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.meetupConfirmBtn, isSettingMeetup && styles.meetupConfirmBtnDisabled]}
              onPress={() => saveMeetupPoint(meetupDraft)}
              disabled={isSettingMeetup}
            >
              <Text style={styles.meetupConfirmText}>
                {isSettingMeetup ? 'Saving…' : 'Set'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centeredFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 15,
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
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  goBackBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
    gap: 10,
  },
  backButton: {
    padding: 4,
  },
  backArrow: {
    fontSize: 22,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  participantBadge: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  menuDots: {
    fontSize: 16,
    color: Colors.textSecondary,
    letterSpacing: 2,
  },

  // ── Expired banner ────────────────────────────────────────────────────────
  expiredBanner: {
    backgroundColor: Colors.errorBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.errorBorder,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  expiredText: {
    color: Colors.errorLight,
    fontSize: 13,
    textAlign: 'center',
  },

  // ── Stream chat layout ────────────────────────────────────────────────────
  //
  // chatWrapper: the critical flex container.
  //   OverlayProvider / Chat / Channel are React context + keyboard providers.
  //   They don't apply any flex sizing to themselves; they adopt the height of
  //   whatever parent contains them. This View gives them a defined, flex-1
  //   height so the inner column (ParticipantStrip + messages + input) can
  //   lay out correctly and MessageInput is never clipped.
  chatWrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // messagesFill: gives MessageList the remaining vertical space so
  // MessageInput is pushed to the bottom of the column, not the screen.
  messagesFill: {
    flex: 1,
  },

  // ── Deleting overlay ──────────────────────────────────────────────────────
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.modalBackdrop,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    zIndex: 100,
  },
  deletingText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Meetup point modal ────────────────────────────────────────────────────
  meetupOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.modalBackdrop,
  },
  meetupSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    gap: 12,
  },
  meetupSheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
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
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  meetupActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  meetupCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
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
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  meetupConfirmBtnDisabled: {
    opacity: 0.5,
  },
  meetupConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
});
