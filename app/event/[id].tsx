// app/event/[id].tsx — Group Chat Screen (Flow 5)
// Triggered by: EventCard "Join Event" / "Open Chat", or My Events tab row tap.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { Colors } from '../../constants/theme';

// ─── Stream dark theme ────────────────────────────────────────────────────────
//
// Color map for stream-chat-expo dark theme:
//   white_snow     → message list background    (Colors.background)
//   grey_whisper   → incoming message bubbles   (Colors.surface)
//   blue_alice     → outgoing message bubbles   (Colors.accent)
//   white          → message input background   (Colors.surface)
//   black          → primary text               (Colors.textPrimary)
//   grey           → secondary text             (Colors.textSecondary)
//   grey_gainsboro → dividers / separators      (Colors.border)
//   accent_blue    → links, selected states     (Colors.accent)

const STREAM_THEME = {
  colors: {
    // Backgrounds
    white_snow: Colors.background,
    bg_gradient_start: Colors.background,
    bg_gradient_end: Colors.background,
    // Message bubbles: incoming = surface, outgoing = accent
    grey_whisper: Colors.surface,
    blue_alice: Colors.accent,
    // Input bar
    white: Colors.surface,
    // Text
    black: Colors.textPrimary,
    grey: Colors.textSecondary,
    grey_gainsboro: Colors.border,
    accent_blue: Colors.accent,
    targetedMessageBackground: Colors.border,
  },
  messageSimple: {
    content: {
      // Force readable text inside all message bubbles
      markdown: {
        text: { color: Colors.textPrimary },
        em: { color: Colors.textPrimary },
        strong: { color: Colors.textPrimary },
        link: { color: Colors.accent },
      },
      containerInner: {
        backgroundColor: Colors.surface, // incoming bubble base
      },
    },
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeetupPoint {
  label: string;
}

// ─── Meetup Banner ────────────────────────────────────────────────────────────

function MeetupBanner({
  meetupPoint,
  isHost,
  onSetMeetupPoint,
}: {
  meetupPoint: MeetupPoint | null;
  isHost?: boolean;
  onSetMeetupPoint?: () => void;
}) {
  return (
    <View style={bannerStyles.container}>
      <Text style={bannerStyles.pin}>📍</Text>
      <View style={bannerStyles.info}>
        {meetupPoint ? (
          <Text style={bannerStyles.label} numberOfLines={1}>
            {meetupPoint.label}
          </Text>
        ) : isHost ? (
          <TouchableOpacity onPress={onSetMeetupPoint} activeOpacity={0.7}>
            <Text style={bannerStyles.noPoint}>No meetup point yet</Text>
            <Text style={bannerStyles.noPointHint}>Tap to set one</Text>
          </TouchableOpacity>
        ) : (
          <Text style={bannerStyles.noPoint}>No meetup point yet</Text>
        )}
      </View>
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
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EventChatScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
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
      try {
        // 1. Fetch event metadata
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('title, participant_count, status, host_id, meetup_point_label')
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
        const ch = streamClient.channel('messaging', `event_${eventId}`);
        await ch.watch();

        if (cancelled) {
          ch.stopWatching().catch(() => {});
          return;
        }

        // 4. Read initial meetup_point from channel custom data (if DB column missing)
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
  const sortedMembers = Object.values(streamChannel.state.members).sort((a, b) => {
    if (a.user?.id === eventHostId) return -1;
    if (b.user?.id === eventHostId) return 1;
    return 0;
  });

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    // Brute-force inset padding: works in Expo Go / Dev Client where native nav bar
    // config overrides are ignored. paddingTop clears the notch/status bar on all
    // platforms; paddingBottom on the input bumper clears the home indicator / nav bar.
    <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>

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
          {/* Tappable member count → opens members modal */}
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

      {/* ── Meetup banner — permanently fixed below header ── */}
      <MeetupBanner
        meetupPoint={meetupPoint}
        isHost={isHost}
        onSetMeetupPoint={handleSetMeetupPoint}
      />

      {/* ── Stream chat ── */}
      <OverlayProvider>
        <Chat client={streamClient} style={STREAM_THEME}>
          <Channel channel={streamChannel} disableKeyboardCompatibleView>
            {/* Message list fills remaining space; marginBottom keeps bubbles off the input */}
            <View style={{ flex: 1, marginBottom: 16 }}>
              <MessageList noGroupByUser />
            </View>

            {/* TODO Phase 4: replace with custom InputBox (photo/camera/poll) */}
            {/* Brute-force bumper: insets.bottom clears home indicator (iOS) / nav bar (Android) */}
            <View style={{ paddingBottom: Platform.OS === 'android' ? insets.bottom + 40 : insets.bottom }}>
              <MessageInput />
            </View>
          </Channel>
        </Chat>
      </OverlayProvider>

      {/* ── Deleting overlay ── */}
      {isDeleting && (
        <View style={styles.deletingOverlay}>
          <ActivityIndicator size="large" color={Colors.white} />
          <Text style={styles.deletingText}>Deleting event…</Text>
        </View>
      )}

      {/* ── Options modal (custom bottom sheet, replaces native ActionSheet) ── */}
      <Modal
        visible={optionsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setOptionsModalVisible(false)}
        />
        <View style={[styles.optionsSheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.sheetHandle} />

          {isHost ? (
            <>
              <Pressable
                style={styles.optionRow}
                onPress={() => {
                  setOptionsModalVisible(false);
                  handleSetMeetupPoint();
                }}
              >
                <Text style={styles.optionText}>Edit Meetup Point</Text>
              </Pressable>
              <View style={styles.optionDivider} />

              <Pressable
                style={styles.optionRow}
                onPress={() => {
                  setOptionsModalVisible(false);
                  console.log('Open Map Edit');
                }}
              >
                <Text style={styles.optionText}>Edit Pin Location</Text>
              </Pressable>
              <View style={styles.optionDivider} />

              <Pressable
                style={styles.optionRow}
                onPress={() => {
                  setOptionsModalVisible(false);
                  // Delay so modal finishes closing before Alert opens
                  setTimeout(handleDeleteEvent, 300);
                }}
              >
                <Text style={[styles.optionText, styles.optionDestructive]}>
                  Delete Event
                </Text>
              </Pressable>
              <View style={styles.optionDivider} />
            </>
          ) : (
            <>
              <Pressable
                style={styles.optionRow}
                onPress={() => {
                  setOptionsModalVisible(false);
                  Alert.alert('Reported', 'Thanks — this event has been flagged for review.');
                }}
              >
                <Text style={[styles.optionText, styles.optionDestructive]}>
                  Report Event
                </Text>
              </Pressable>
              <View style={styles.optionDivider} />
            </>
          )}

          <Pressable
            style={styles.optionRow}
            onPress={() => setOptionsModalVisible(false)}
          >
            <Text style={styles.optionText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {/* ── Meetup point input modal ── */}
      <Modal
        visible={meetupModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMeetupModalVisible(false)}
      >
        {/*
         * KAV wraps the whole modal so the sheet slides up with the keyboard.
         * The backdrop Pressable sits inside it at absoluteFill so tapping
         * outside the sheet dismisses the modal.
         */}
        <KeyboardAvoidingView
          style={styles.meetupKAV}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setMeetupModalVisible(false)}
          />
          <View style={[styles.meetupSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />
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
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Delete confirmation modal (centered fade, no native Alert) ── */}
      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <Pressable
          style={styles.deleteConfirmOverlay}
          onPress={() => setDeleteConfirmVisible(false)}
        />
        <View style={styles.deleteConfirmCard}>
          <Text style={styles.deleteConfirmTitle}>Delete Event?</Text>
          <Text style={styles.deleteConfirmBody}>
            Are you sure? This cannot be undone.
          </Text>
          <View style={styles.deleteConfirmActions}>
            <Pressable
              style={styles.deleteConfirmCancelBtn}
              onPress={() => setDeleteConfirmVisible(false)}
            >
              <Text style={styles.deleteConfirmCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.deleteConfirmDeleteBtn}
              onPress={executeDeleteEvent}
            >
              <Text style={styles.deleteConfirmDeleteText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Members modal (bottom sheet, sorted: host first) ── */}
      <Modal
        visible={isMembersModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsMembersModalVisible(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setIsMembersModalVisible(false)}
        />
        <View style={[styles.membersSheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.membersTitle}>Event Members</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {sortedMembers.map((member) => {
              const isThisHost = member.user?.id === eventHostId;
              const avatarUri = member.user?.image as string | undefined;
              const displayName = (member.user?.name as string | undefined) ?? 'Unknown';
              const userId = member.user?.id ?? '';
              return (
                <Pressable
                  key={userId || member.user_id}
                  style={({ pressed }) => [
                    styles.memberRow,
                    pressed && styles.memberRowPressed,
                  ]}
                  onPress={() => {
                    setIsMembersModalVisible(false);
                    if (userId) router.push(`/user/${userId}`);
                  }}
                >
                  {avatarUri ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={styles.memberAvatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.memberAvatar, styles.memberAvatarFallback]}>
                      <Text style={styles.memberAvatarEmoji}>👤</Text>
                    </View>
                  )}
                  <Text style={styles.memberName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  {isThisHost && (
                    <View style={styles.hostBadge}>
                      <Text style={styles.hostBadgeText}>Host</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

    </View>
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

  // ── Shared bottom-sheet chrome ────────────────────────────────────────────
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.modalBackdrop,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },

  // ── Options modal ─────────────────────────────────────────────────────────
  optionsSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
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

  // ── Meetup KAV wrapper ────────────────────────────────────────────────────
  meetupKAV: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  // ── Delete confirm modal ──────────────────────────────────────────────────
  deleteConfirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  deleteConfirmCard: {
    position: 'absolute',
    left: 32,
    right: 32,
    top: '40%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
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
    gap: 10,
    marginTop: 4,
  },
  deleteConfirmCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
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
    borderRadius: 10,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  deleteConfirmDeleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },

  // ── Meetup point modal ────────────────────────────────────────────────────
  meetupSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 12,
  },
  meetupSheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 4,
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

  // ── Members modal ─────────────────────────────────────────────────────────
  membersSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '70%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 0,
  },
  membersTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  memberRowPressed: {
    backgroundColor: Colors.background,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.accentSubtle ?? Colors.surface,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  hostBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 0.3,
  },
});
