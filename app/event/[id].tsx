// app/event/[id].tsx — Group Chat Screen (Flow 5)
// Triggered by: EventCard "Join Event" / "Open Chat", or My Events tab row tap.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Channel,
  Chat,
  MessageInput,
  MessageList,
  MessageSimple,
} from 'stream-chat-expo';
import type { Channel as StreamChannel, MessageResponse } from 'stream-chat';

import { supabase } from '../../lib/supabase';
import { streamClient } from '../../lib/streamClient';
import { useAuthStore } from '../../stores/authStore';
import { useBlockedUsers } from '../../hooks/useBlockedUsers';
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

// ─── Custom Message Actions ──────────────────────────────────────────────────
// Adds a "Report Message" option to the long-press menu.
// React and Reply are enabled by default via the Channel props below.

async function reportMessageToSupabase(
  reporterId: string,
  message: MessageResponse,
  channelId: string,
) {
  try {
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      reported_user_id: message.user?.id ?? null,
      message_id: message.id,
      channel_id: channelId,
      reason: 'inappropriate',
    });
    if (error) throw error;
    Alert.alert('Reported', 'Thanks for flagging this. We\'ll take a look.');
  } catch (err) {
    Alert.alert('Error', 'Could not submit report. Try again later.');
    console.error('[Report] insert failed:', err);
  }
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EventChatScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const isMockEvent = eventId === MOCK_EVENT_ID;
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
  const [eventCoords, setEventCoords] = useState<{ latitude: number; longitude: number } | null>(null);

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
  // isLeaving: locks the UI during the leave-event Edge Function call
  const [isLeaving, setIsLeaving] = useState(false);

  // isParticipant: true if the current user is already a member of this event's Stream channel
  const [isParticipant, setIsParticipant] = useState(false);
  // maxParticipants: null means unlimited
  const [maxParticipants, setMaxParticipants] = useState<number | null>(null);
  const [isFull, setIsFull] = useState(false);
  // isJoining: locks the Join button during the Edge Function call
  const [isJoining, setIsJoining] = useState(false);

  const channelRef = useRef<StreamChannel | null>(null);

  const isHost = user?.id === eventHostId;

  // ── Blocked users — hide their messages in the chat ─────────────────────
  const blockedUserIds = useBlockedUsers();
  const blockedRef = useRef(blockedUserIds);
  blockedRef.current = blockedUserIds;

  // Stable component reference — uses a ref so the function identity never
  // changes, preventing Channel from unmounting/remounting the message tree.
  // Passed as `MessageSimple` (not `Message`) so the SDK's Message wrapper
  // still provides MessageContext (isMessageAIGenerated, reactions, etc.).
  const BlockFilteredMessageSimple = useCallback(
    (props: any) => {
      if (blockedRef.current.size > 0 && blockedRef.current.has(props.message?.user?.id)) {
        return null;
      }
      return <MessageSimple {...props} />;
    },
    [], // stable — reads blockedUserIds via ref
  );

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
        // 1. Fetch event metadata (.maybeSingle avoids PGRST116 crash on missing rows)
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('title, participant_count, max_participants, status, host_id, meetup_point_label, location')
          .eq('id', eventId)
          .maybeSingle();

        if (eventError) {
          console.error('[EventChat] DB ERROR:', eventError);
          if (!cancelled) setConnectError(`DB Error: ${eventError.message}`);
          return;
        }

        if (!eventData) {
          console.warn('[EventChat] Event not found — deleted or expired. eventId:', eventId);
          if (!cancelled) {
            Alert.alert('Event Not Found', 'This event no longer exists.');
            router.replace('/(tabs)/');
          }
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
          // Parse location for Edit Pin screen — PostgREST returns GeoJSON for geography columns
          if (eventData.location && typeof eventData.location === 'object') {
            const [lon, lat] = (eventData.location as { coordinates: [number, number] }).coordinates;
            if (isFinite(lat) && isFinite(lon)) {
              setEventCoords({ latitude: lat, longitude: lon });
            }
          }
        }

        // 2. Stream user sync is handled reactively in _layout.tsx
        //    (watches profile changes → partialUpdateUser).

        if (cancelled) return;

        // 3. Watch the channel — makes it "live", populates channel.data + state.members.
        // Channel ID has the 'event_' prefix (set by create-event Edge Function).
        // Retry once after 1.5 s to handle transient Stream propagation delays.
        const ch = streamClient.channel('messaging', `event_${eventId}`);
        let watchAttempts = 0;
        while (true) {
          try {
            await ch.watch();
            break;
          } catch (watchErr) {
            watchAttempts++;
            if (watchAttempts >= 2) throw watchErr;
            console.warn('[EventChat] ch.watch() attempt', watchAttempts, 'failed — retrying in 1.5 s');
            await new Promise(res => setTimeout(res, 1_500));
          }
        }

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
        // 1. Write to DB first — DB is the canonical source of truth.
        // supabase.update() returns {data, error} and never throws, so we must
        // check the error field explicitly.
        const { error: dbError } = await supabase
          .from('events')
          .update({ meetup_point_label: trimmed })
          .eq('id', eventId);
        if (dbError) throw new Error(dbError.message);

        // 2. Push to Stream (notification layer) — non-fatal if it fails.
        // DB already has the correct value, so the banner will show it on next
        // cold load even if the channel.updated listener never fires.
        try {
          await streamChannel.updatePartial({ set: { meetup_point: { label: trimmed } } });
        } catch (streamErr) {
          console.warn('[saveMeetupPoint] Stream updatePartial failed (non-fatal):', streamErr);
        }

        // 3. Update local state directly so the banner refreshes immediately.
        setMeetupPoint({ label: trimmed });
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

  const handleEditPinLocation = useCallback(() => {
    if (!eventCoords) return;
    router.push(
      `/event/edit-location?eventId=${eventId}&lat=${eventCoords.latitude}&lon=${eventCoords.longitude}`,
    );
  }, [eventCoords, eventId, router]);

  // ── Join event ─────────────────────────────────────────────────────────────
  // The Edge Function handles both the DB insert and Stream channel membership
  // atomically (with rollback). Client must NOT call channel.addMembers separately.
  const handleJoinEvent = useCallback(async () => {
    if (!user || !eventId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsJoining(true);
    try {
      // Always fetch a live session token. Do NOT rely on supabase.functions.invoke
      // auto-injecting the auth header — the FunctionsClient is constructed once
      // at app start with the anon key and its static headers are NOT updated when
      // the session changes (account switch, sign-out/sign-in). Passing the token
      // explicitly as an override header is the only reliable approach.
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        Alert.alert('Session Error', 'Your session has expired. Please sign in again.');
        return;
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/join-event`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ event_id: eventId }),
        },
      );

      const data = await response.json();

      // Check semantic codes before inspecting response.ok — mirrors EventCard pattern.
      if (data?.code === 'EVENT_EXPIRED') {
        Alert.alert('Event Ended', 'This event has already expired.');
        setEventStatus('expired');
        return;
      }
      if (data?.code === 'VERIFIED_ONLY') {
        Alert.alert(
          'Verified Travelers Only',
          data.error ?? 'You need to be verified to join this event.',
        );
        return;
      }
      if (data?.code === 'CHAT_ROOM_MISSING') {
        Alert.alert(
          'Chat Room Unavailable',
          "This event's chat room hasn't been set up yet. Please wait a moment and try again, or contact the host.",
        );
        return;
      }
      if (data?.code === 'LIMIT_REACHED') {
        Alert.alert('Event Full', data.error ?? 'This event just filled up.');
        setIsFull(true);
        return;
      }

      if (!response.ok) {
        throw new Error(`SERVER SAID: ${data.error || JSON.stringify(data)}`);
      }

      // Success — join-event now returns already_member:true when the DB insert
      // was idempotent (23505). Only increment the display count for new joins.
      setIsParticipant(true);
      if (!data?.already_member) {
        setParticipantCount(prev => prev + 1);
        setIsFull(maxParticipants !== null && participantCount + 1 >= maxParticipants);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Join Failed', msg);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Session Expired', 'Your session has expired. Please sign in again.');
        setIsDeleting(false);
        return;
      }
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({ event_id: eventId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`SERVER SAID: ${data.error || JSON.stringify(data)}`);
      }

      // Clear overlay BEFORE navigating so it doesn't persist during transition
      setIsDeleting(false);
      router.replace('/(tabs)/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[EventChat] delete-event error:', msg);
      Alert.alert('The Real Error', msg);
      setIsDeleting(false);
    }
  }, [eventId, router]);

  // ── Leave event (participant only) ─────────────────────────────────────────
  // Shows a native confirmation alert before invoking the Edge Function.
  // On success, drops the user back to spectator mode (read-only chat).
  const handleLeaveEvent = useCallback(() => {
    if (!user || !eventId || isLeaving) return;
    Alert.alert(
      'Leave Event',
      'You can rejoin later if spots are still available.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setIsLeaving(true);
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) {
                Alert.alert('Session Expired', 'Your session has expired. Please sign in again.');
                setIsLeaving(false);
                return;
              }
              const response = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/leave-event`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
                  },
                  body: JSON.stringify({ event_id: eventId }),
                },
              );
              const data = await response.json();
              if (!response.ok) throw new Error(data.error || 'Leave failed.');
              // Optimistic update — user is now a spectator (read-only)
              setIsParticipant(false);
              setParticipantCount(prev => Math.max(0, prev - 1));
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Could not leave the event. Please try again.';
              Alert.alert('Error', msg);
            } finally {
              setIsLeaving(false);
            }
          },
        },
      ],
    );
  }, [user, eventId, isLeaving]);

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
    // OverlayProvider lives in app/_layout.tsx — do NOT nest it here.
    // Single wrapper; Stream's KeyboardCompatibleView (enabled via
    // disableKeyboardCompatibleView={false}) handles all keyboard avoidance.
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.background,
        paddingTop: insets.top,
      }}
    >

        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
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
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsMembersModalVisible(true);
              }}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            >
              <Text style={styles.participantBadge}>
                👥 {streamChannel ? Object.keys(streamChannel.state.members).length : participantCount}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setOptionsModalVisible(true);
              }}
              disabled={isDeleting}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.menuDots}>•••</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Banners (Expired / Meetup / Join) ── */}
        {eventStatus === 'expired' && (
          <View style={styles.expiredBanner}>
            <Text style={styles.expiredText}>This one's over — chat is read-only.</Text>
          </View>
        )}

        <MeetupBanner
          meetupPoint={meetupPoint}
          isHost={isHost}
          onSetMeetupPoint={handleSetMeetupPoint}
        />

        {!isHost && !isParticipant && (
          <View style={styles.joinBar}>
            {isFull ? (
              <View style={[styles.joinButton, styles.joinButtonDisabled]}>
                <Text style={styles.joinButtonTextMuted}>Event Full</Text>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.joinButton,
                  styles.joinButtonAccent,
                  isJoining && styles.joinButtonLoading,
                  pressed && !isJoining && { opacity: 0.85 },
                ]}
                onPress={handleJoinEvent}
                disabled={isJoining}
              >
                {isJoining
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.joinButtonText}>Count me in.</Text>
                }
              </Pressable>
            )}
          </View>
        )}

        {/* ── Stream Chat Container ── */}
        {/* Android: softwareKeyboardLayoutMode="resize" in app.config.js handles
            keyboard avoidance natively — no KAV needed. Stream's KCV is disabled
            to prevent double-adjustment.
            iOS: Stream's built-in KeyboardCompatibleView handles avoidance. */}
          <Chat client={streamClient} style={STREAM_THEME}>
            <Channel
              channel={streamChannel}
              disableKeyboardCompatibleView={Platform.OS === 'android'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
              enableMessageReactions
              enableMessageReplies
              MessageSimple={BlockFilteredMessageSimple}
              messageActions={({ message, dismissOverlay }) => {
                const actions = [
                  {
                    title: 'Report',
                    icon: undefined,
                    action: () => {
                      dismissOverlay();
                      if (user && message) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        reportMessageToSupabase(
                          user.id,
                          message as MessageResponse,
                          `event_${eventId}`,
                        );
                      }
                    },
                    titleStyle: { color: Colors.error },
                  },
                ];
                return actions;
              }}
            >
              <MessageList noGroupByUser showUserAvatars />

              {(isParticipant || isHost) && (
                <View style={{ paddingBottom: Platform.OS === 'ios' ? insets.bottom : 0 }}>
                  <MessageInput />
                </View>
              )}
            </Channel>
          </Chat>

        {/* ── Overlays & Modals ── */}
        {isDeleting && (
          <View style={styles.deletingOverlay}>
            <ActivityIndicator size="large" color={Colors.white} />
            <Text style={styles.deletingText}>Deleting event…</Text>
          </View>
        )}

        <OptionsModal
          visible={optionsModalVisible}
          onClose={() => setOptionsModalVisible(false)}
          isHost={isHost}
          isParticipant={isParticipant}
          insetsBottom={insets.bottom}
          eventId={eventId ?? ''}
          onSetMeetupPoint={handleSetMeetupPoint}
          onEditPinLocation={handleEditPinLocation}
          onDeleteEvent={handleDeleteEvent}
          onLeaveEvent={handleLeaveEvent}
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
);
}