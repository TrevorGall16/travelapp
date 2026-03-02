// app/event/[id].tsx — Group Chat Screen (Flow 5)
// Triggered by: EventCard "Join Event" / "Open Chat", or My Events tab row tap.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { Colors } from '../../constants/theme';
import { styles, STREAM_THEME } from '../../styles/eventChatStyles';
import { MeetupBanner } from '../../components/chat/MeetupBanner';
import type { MeetupPoint } from '../../components/chat/MeetupBanner';
import { OptionsModal } from '../../components/chat/OptionsModal';
import { MeetupModal } from '../../components/chat/MeetupModal';
import { DeleteConfirmModal } from '../../components/chat/DeleteConfirmModal';
import { MembersModal } from '../../components/chat/MembersModal';
import type { MemberEntry } from '../../components/chat/MembersModal';

// ─── Mock Testing Data ───────────────────────────────────────────────────────
// Activated when eventId === "test-paris". Bypasses all Supabase fetching.
// Stream Chat connects to the "paris-sandbox" public channel instead.

const MOCK_EVENT_ID = 'test-paris';
const MOCK_STREAM_CHANNEL = 'paris-sandbox';

const MOCK_STATE = {
  title: 'The Paris Testing Ground 🇫🇷',
  description: 'This is a hardcoded event for UI testing. None of this is in the database.',
  participantCount: 4,
  maxParticipants: 20,
  hostId: 'mock-host-marco',
  meetupPoint: { label: 'Châtelet Metro Station, Exit 11' },
};

// Fake members — IDs are stable so profile navigation can be tested
const MOCK_MEMBERS: MemberEntry[] = [
  { user: { id: 'mock-host-marco',   name: 'Marco the Explorer', image: null } },
  { user: { id: 'mock-user-sarah',   name: 'Sarah (France)',     image: null } },
  { user: { id: 'mock-user-hiroshi', name: 'Hiroshi (Japan)',    image: null } },
  { user: { id: 'mock-user-elena',   name: 'Elena (Italy)',      image: null } },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EventChatScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const isMockEvent = eventId === MOCK_EVENT_ID;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // useWindowDimensions gives the live usable window (excludes nav bar on Android).
  // Dimensions.get('screen') is the full physical display height.
  // The difference is the exact hardware nav bar height on any device, even when
  // useSafeAreaInsets().bottom returns 0 in Expo Go / Dev Client.
  const { height: windowHeight } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;
  const androidNavBarHeight = screenHeight - windowHeight;
  // +20px safe margin ensures clearance even if the OS draws a thin gesture handle
  const bottomBumper = Platform.OS === 'android'
    ? androidNavBarHeight + 20
    : insets.bottom;

  const { user, profile, streamToken } = useAuthStore();

  // ── State ──────────────────────────────────────────────────────────────────
  const [isConnecting, setIsConnecting] = useState(true);
  const [streamChannel, setStreamChannel] = useState<StreamChannel | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [eventTitle, setEventTitle] = useState('');
  const [participantCount, setParticipantCount] = useState(0);
  const [eventStatus, setEventStatus] = useState<'active' | 'expired'>('active');
  const [eventHostId, setEventHostId] = useState<string | null>(null);

  const [meetupPoint, setMeetupPoint] = useState<MeetupPoint | null>(null);

  // Options modal (replaces native ActionSheet / Alert.alert for the ••• menu)
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  // Delete confirmation modal (replaces Alert.alert — looks better on Android)
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  // Members modal (tappable 👥 count → bottom-sheet member directory)
  const [isMembersModalVisible, setIsMembersModalVisible] = useState(false);

  // Meetup input modal — cross-platform (no Alert.prompt dependency)
  const [meetupModalVisible, setMeetupModalVisible] = useState(false);
  const [meetupDraft, setMeetupDraft] = useState('');
  const [isSettingMeetup, setIsSettingMeetup] = useState(false);

  // isDeleting: locks the UI during the delete-event Edge Function call
  const [isDeleting, setIsDeleting] = useState(false);

  // isParticipant: true if the current user is already a member of this event's Stream channel
  const [isParticipant, setIsParticipant] = useState(false);
  // maxParticipants: null means unlimited
  const [maxParticipants, setMaxParticipants] = useState<number | null>(null);
  const [isFull, setIsFull] = useState(false);
  // isJoining: locks the Join button during the Edge Function call
  const [isJoining, setIsJoining] = useState(false);

  const channelRef = useRef<StreamChannel | null>(null);

  const isHost = user?.id === eventHostId;


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

      // ── MOCK MODE: bypass Supabase entirely ────────────────────────────────
      if (isMockEvent) {
        if (!cancelled) {
          setEventTitle(MOCK_STATE.title);
          setParticipantCount(MOCK_STATE.participantCount);
          setMaxParticipants(MOCK_STATE.maxParticipants);
          setEventStatus('active');
          setEventHostId(MOCK_STATE.hostId);
          setIsFull(false);
          setIsParticipant(true);   // always "in" so MessageInput is visible
          setMeetupPoint(MOCK_STATE.meetupPoint);
        }

        // Still connect to a real Stream channel so the MessageInput actually works
        try {
          if (!streamClient.userID) {
            await streamClient.connectUser(
              { id: user.id, name: profile.display_name, image: profile.avatar_url },
              streamToken,
            );
          }
          if (cancelled) return;

          const ch = streamClient.channel('messaging', MOCK_STREAM_CHANNEL);
          await ch.watch();

          if (cancelled) { ch.stopWatching().catch(() => {}); return; }
          channelRef.current = ch;
          setStreamChannel(ch);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn('[EventChat] Mock mode: Stream connection failed:', msg);
          setConnectError(`Stream error (mock mode): ${msg}`);
        } finally {
          if (!cancelled) setIsConnecting(false);
        }
        return; // skip real Supabase path
      }
      // ── END MOCK MODE ──────────────────────────────────────────────────────

      try {
        // 1. Fetch event metadata
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('title, participant_count, max_participants, status, host_id, meetup_point_label')
          .eq('id', eventId)
          .single();

        if (eventError || !eventData) {
          console.error('[EventChat] DB ERROR:', eventError);
          if (!cancelled) setConnectError(`DB Error: ${eventError?.message || 'No data returned'}`);
          return;
        }

        if (!cancelled) {
          setEventTitle(eventData.title);
          setParticipantCount(eventData.participant_count);
          setEventStatus(eventData.status as 'active' | 'expired');
          setEventHostId(eventData.host_id ?? null);
          const cap = eventData.max_participants ?? null;
          setMaxParticipants(cap);
          setIsFull(cap !== null && eventData.participant_count >= cap);
          // Prefer DB meetup_point_label over channel data for initial load
          if (eventData.meetup_point_label) {
            setMeetupPoint({ label: eventData.meetup_point_label });
          }
        }

        // 2. Connect Stream user — idempotent: skip if already connected
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

        // 3. Watch the channel — makes it "live", populates channel.data + state.members
        const ch = streamClient.channel('messaging', eventId);
        await ch.watch();

        if (cancelled) {
          ch.stopWatching().catch(() => {});
          return;
        }

        // 4. Determine participation: current user in ch.state.members → already a member
        if (!cancelled) {
          setIsParticipant(
            Object.prototype.hasOwnProperty.call(ch.state.members, user.id)
          );
        }

        // 5. Read initial meetup_point from channel custom data (if DB column missing)
        if (!eventData.meetup_point_label) {
          const rawMeetup = (ch.data as Record<string, unknown>)?.meetup_point;
          if (rawMeetup && typeof rawMeetup === 'object') {
            const mp = rawMeetup as { label?: string };
            if (mp.label) setMeetupPoint({ label: mp.label });
          }
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

  // ── Listen for meetup_point updates via Stream channel ─────────────────────
  useEffect(() => {
    if (!streamChannel) return;

    const { unsubscribe } = streamChannel.on('channel.updated', (event) => {
      const updated = event.channel as Record<string, unknown> | undefined;
      const raw = updated?.meetup_point;
      if (raw && typeof raw === 'object') {
        const mp = raw as { label?: string };
        if (mp.label) {
          setMeetupPoint({ label: mp.label });
        } else {
          setMeetupPoint(null);
        }
      } else {
        setMeetupPoint(null);
      }
    });

    return () => unsubscribe();
  }, [streamChannel]);

  // ── Save meetup point (host only) ──────────────────────────────────────────
  const saveMeetupPoint = useCallback(
    async (label: string) => {
      const trimmed = label.trim();
      if (!trimmed || !streamChannel) return;
      setIsSettingMeetup(true);
      try {
        // Update Stream channel custom data — triggers channel.updated listener
        await streamChannel.updatePartial({
          set: { meetup_point: { label: trimmed } },
        });
        // DB persistence — migration: ALTER TABLE events ADD COLUMN meetup_point_label TEXT;
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
    setMeetupDraft(meetupPoint?.label ?? '');
    setMeetupModalVisible(true);
  }, [meetupPoint]);

  // ── Join event ─────────────────────────────────────────────────────────────
  // The Edge Function handles both the DB insert and Stream channel membership
  // atomically (with rollback). Client must NOT call channel.addMembers separately.
  const handleJoinEvent = useCallback(async () => {
    if (!user || !eventId) return;
    setIsJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke('join-event', {
        body: { event_id: eventId },
      });

      if (error) throw new Error(error.message ?? 'Join failed.');

      if (data?.code === 'EVENT_EXPIRED') {
        Alert.alert('Event Ended', 'This event has already expired.');
        setEventStatus('expired');
        return;
      }
      if (data?.code === 'VERIFIED_ONLY') {
        Alert.alert('Verified Travelers Only', data.error ?? 'You need to be verified to join this event.');
        return;
      }
      if (data?.code === 'LIMIT_REACHED' || data?.error) {
        Alert.alert('Sorry!', data.error ?? 'This event just filled up.');
        setIsFull(true);
        return;
      }

      // Success — update local state optimistically
      setIsParticipant(true);
      if (!data?.already_member) {
        setParticipantCount(prev => prev + 1);
        setIsFull(maxParticipants !== null && participantCount + 1 >= maxParticipants);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not join the event. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setIsJoining(false);
    }
  }, [user, eventId, maxParticipants, participantCount]);

  // ── Delete event (host only) ────────────────────────────────────────────────
  // Architecture: all deletions go through the delete-event Edge Function,
  // which syncs Stream.io before removing the DB row. Client never writes DELETE.
  const handleDeleteEvent = useCallback(() => {
    setDeleteConfirmVisible(true);
  }, []);

  const executeDeleteEvent = useCallback(async () => {
    setDeleteConfirmVisible(false);
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-event', {
        body: { event_id: eventId },
      });
      if (error) {
        throw new Error(error.message ?? 'Delete failed.');
      }
      router.replace('/(tabs)/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not delete the event.';
      console.error('[EventChat] delete-event error:', msg);
      Alert.alert('Error', msg);
      setIsDeleting(false);
    }
  }, [eventId, router]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isConnecting) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
        <View style={styles.centeredFill}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Connecting to chat…</Text>
        </View>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (connectError || !streamChannel) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
        <View style={styles.centeredFill}>
          <Text style={styles.errorLabel}>⚠️ Connection Failed</Text>
          <Text style={styles.errorText}>
            {connectError ?? 'Could not load chat.'}
          </Text>
          <Pressable style={styles.goBackBtn} onPress={() => router.back()}>
            <Text style={styles.goBackBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Members list: host pinned first, then rest ─────────────────────────────
  // In mock mode use MOCK_MEMBERS directly — the sandbox channel has no real members.
  const sortedMembers: MemberEntry[] = isMockEvent
    ? MOCK_MEMBERS
    : Object.values(streamChannel.state.members).sort((a, b) => {
        if (a.user?.id === eventHostId) return -1;
        if (b.user?.id === eventHostId) return 1;
        return 0;
      });

// ── Main render ────────────────────────────────────────────────────────────
  return (
    // 1. OverlayProvider MUST be the absolute root so its attachment menus never get squished
    <OverlayProvider>
      {/* 2. KeyboardAvoidingView handles the custom Android keyboard */}
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.background }}
        behavior="padding"
      >
        {/* 3. insets.bottom prevents the gap when closed, KeyboardAvoidingView pushes it up when open */}
        <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>

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
            <Pressable
              onPress={() => setIsMembersModalVisible(true)}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            >
              <Text style={styles.participantBadge}>👥 {participantCount}</Text>
            </Pressable>
            <Pressable
              onPress={() => setOptionsModalVisible(true)}
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

        {/* ── Meetup banner ── */}
        <MeetupBanner
          meetupPoint={meetupPoint}
          isHost={isHost}
          onSetMeetupPoint={handleSetMeetupPoint}
        />

        {/* ── Join bar ── */}
        {!isHost && (
          <View style={styles.joinBar}>
            {isParticipant ? null : isFull ? (
              <View style={[styles.joinButton, styles.joinButtonDisabled]}>
                <Text style={styles.joinButtonTextMuted}>Event Full</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.joinButton, styles.joinButtonAccent, isJoining && styles.joinButtonLoading]}
                onPress={handleJoinEvent}
                disabled={isJoining}
                activeOpacity={0.8}
              >
                {isJoining
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.joinButtonText}>Join Meetup</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Stream chat ── */}
        <View style={{ flex: 1 }}>
          <Chat client={streamClient} style={STREAM_THEME}>
            {/* 4. Disable Stream's math so it doesn't fight KeyboardAvoidingView */}
            <Channel channel={streamChannel} disableKeyboardCompatibleView={true}>

              <View style={{ flex: 1, marginBottom: 16 }}>
                <MessageList noGroupByUser />
              </View>

              {(isParticipant || isHost) && (
                <MessageInput />
              )}

            </Channel>
          </Chat>
        </View>

        {/* ── Deleting overlay ── */}
        {isDeleting && (
          <View style={styles.deletingOverlay}>
            <ActivityIndicator size="large" color={Colors.white} />
            <Text style={styles.deletingText}>Deleting event…</Text>
          </View>
        )}

        {/* ── Modals ── */}
        <OptionsModal
          visible={optionsModalVisible}
          onClose={() => setOptionsModalVisible(false)}
          isHost={isHost}
          insetsBottom={insets.bottom}
          onSetMeetupPoint={handleSetMeetupPoint}
          onDeleteEvent={handleDeleteEvent}
        />

        <MeetupModal
          visible={meetupModalVisible}
          onClose={() => setMeetupModalVisible(false)}
          meetupDraft={meetupDraft}
          setMeetupDraft={setMeetupDraft}
          onSave={saveMeetupPoint}
          isSettingMeetup={isSettingMeetup}
          insetsBottom={insets.bottom}
        />

        <DeleteConfirmModal
          visible={deleteConfirmVisible}
          onClose={() => setDeleteConfirmVisible(false)}
          onConfirm={executeDeleteEvent}
        />

        <MembersModal
          visible={isMembersModalVisible}
          onClose={() => setIsMembersModalVisible(false)}
          members={sortedMembers}
          eventHostId={eventHostId}
          insetsBottom={insets.bottom}
          onNavigateToUser={(userId) => router.push(`/user/${userId}`)}
        />

        </View>
      </KeyboardAvoidingView>
    </OverlayProvider>
  );
}