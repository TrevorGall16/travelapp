import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ChannelList, Chat } from 'stream-chat-expo';
import type { ChannelPreviewUIComponentProps } from 'stream-chat-expo';

import { streamClient } from '../../lib/streamClient';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Radius, Spacing, STREAM_THEME } from '../../constants/theme';
import { purgeGhostChannels } from '../../lib/streamCleanup';
import { ActionModal } from '../../components/ActionModal';

// ─── Ghost Channel Purge ─────────────────────────────────────────────────────
// Cross-references Stream channels with Supabase events.
// Channels whose events are missing/deleted are hidden immediately and
// cleaned up in the background via Stream's channel.delete().

async function fetchValidEventIds(userId: string): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('event_participants')
      .select('event_id')
      .eq('user_id', userId);

    if (error || !data) return new Set();

    const eventIds = data.map((r: { event_id: string }) => r.event_id);
    if (eventIds.length === 0) return new Set();

    // Verify these events actually exist AND are still active
    const { data: existingEvents } = await supabase
      .from('events')
      .select('id')
      .in('id', eventIds)
      .eq('status', 'active');

    return new Set((existingEvents ?? []).map((e: { id: string }) => e.id));
  } catch {
    return new Set();
  }
}

function backgroundDeleteChannel(channelId: string) {
  // Fire-and-forget: remove the ghost channel from Stream
  const ch = streamClient.channel('messaging', channelId);
  ch.delete().catch((err) => {
    console.warn('[GhostPurge] Failed to delete channel:', channelId, err);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(date?: string | Date | null): string {
  if (!date) return '';
  const ms = Date.now() - new Date(date as string).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ─── Custom channel preview row ──────────────────────────────────────────────

function EventChannelPreview(
  props: ChannelPreviewUIComponentProps & {
    validEventIds?: Set<string>;
    onRequestLeave?: (channelName: string, eventId: string) => void;
  },
) {
  const router = useRouter();
  const { channel, latestMessagePreview, unreadCount, validEventIds, onRequestLeave } = props;

  const rawId = channel.id ?? '';
  const eventId = rawId.startsWith('event_') ? rawId.slice('event_'.length) : rawId;

  // ── Ghost check: hide channels for deleted/missing events ──
  if (validEventIds && validEventIds.size > 0 && !validEventIds.has(eventId)) {
    // Trigger background cleanup on first render of this ghost
    backgroundDeleteChannel(rawId);
    return null;
  }

  const channelName = (channel.data?.name as string | undefined) ?? 'Event Chat';
  const avatarUrl = channel.data?.image as string | undefined;

  const previewText =
    (latestMessagePreview?.previews as Array<{ text?: string }> | undefined)?.[0]?.text ??
    (latestMessagePreview?.messageObject as { text?: string } | undefined)?.text ??
    'No messages yet';

  const timestamp = relativeTime(
    (latestMessagePreview?.messageObject as { created_at?: string } | undefined)?.created_at ??
    (channel.data?.last_message_at as string | undefined),
  );

  const hasUnread = (unreadCount ?? 0) > 0;

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRequestLeave?.(channelName, eventId);
  }, [channelName, eventId, onRequestLeave]);

  return (
    <Pressable
      style={({ pressed }) => [rowStyles.row, pressed && rowStyles.rowPressed]}
      onPress={() => eventId && router.push(`/event/${eventId}`)}
      onLongPress={handleLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`Open ${channelName} chat`}
    >
      {/* Avatar */}
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={rowStyles.avatar} contentFit="cover" />
      ) : (
        <View style={rowStyles.avatarFallback}>
          <Text style={rowStyles.avatarEmoji}>💬</Text>
        </View>
      )}

      {/* Name + preview */}
      <View style={rowStyles.body}>
        <View style={rowStyles.top}>
          <Text style={rowStyles.name} numberOfLines={1}>{channelName}</Text>
          {timestamp ? <Text style={rowStyles.time}>{timestamp}</Text> : null}
        </View>
        <Text
          style={[rowStyles.preview, hasUnread && rowStyles.previewUnread]}
          numberOfLines={1}
        >
          {previewText}
        </Text>
      </View>

      {/* Unread badge */}
      {hasUnread && (
        <View style={rowStyles.badge}>
          <Text style={rowStyles.badgeText}>{unreadCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: Colors.background,
  },
  rowPressed: {
    backgroundColor: Colors.surface,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.border,
    flexShrink: 0,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarEmoji: { fontSize: 24 },
  body: { flex: 1, gap: 4 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  time: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
    flexShrink: 0,
  },
  preview: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  previewUnread: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ChatsScreen() {
  const { user } = useAuthStore();
  const [validEventIds, setValidEventIds] = useState<Set<string>>(new Set());

  // ── Leave chat modal state ──
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [leaveChannelName, setLeaveChannelName] = useState('');
  const [leaveEventId, setLeaveEventId] = useState('');

  const handleRequestLeave = useCallback((channelName: string, eventId: string) => {
    setLeaveChannelName(channelName);
    setLeaveEventId(eventId);
    setActionModalVisible(true);
  }, []);

  const handleLeaveConfirm = useCallback(async () => {
    setActionModalVisible(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { Alert.alert('Session Expired'); return; }
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/leave-event`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ event_id: leaveEventId }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Leave failed.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not leave chat.');
    }
  }, [leaveEventId]);

  // Fetch valid event IDs on mount + every focus to catch newly deleted events
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      fetchValidEventIds(user.id).then(setValidEventIds);
      // Proactive cleanup: delete Stream channels for events that no longer exist
      purgeGhostChannels();
    }, [user]),
  );

  // Stream client is connected centrally in _layout.tsx.
  const [ready] = useState(() => !!streamClient.userID);

  // ── Not connected yet ────────────────────────────────────────────────────
  if (!ready && !streamClient.userID) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Messages</Text>
        </View>
        <View style={styles.centeredFill}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Messages</Text>
        </View>
        <View style={styles.centeredFill}>
          <Text style={styles.errorLabel}>Connection Failed</Text>
          <Text style={styles.errorText}>Not signed in.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Messages</Text>
      </View>

      <Chat client={streamClient} style={STREAM_THEME}>
        <ChannelList
          filters={{ type: 'messaging', members: { $in: [user.id] } }}
          sort={{ last_message_at: -1 }}
          Preview={(previewProps) => (
            <EventChannelPreview {...previewProps} validEventIds={validEventIds} onRequestLeave={handleRequestLeave} />
          )}
          EmptyStateIndicator={() => (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyBody}>
                Tap a pin on the map and join an event to start chatting.
              </Text>
            </View>
          )}
        />
      </Chat>

      <ActionModal
        visible={actionModalVisible}
        onClose={() => setActionModalVisible(false)}
        title={leaveChannelName}
        actions={[
          {
            label: 'Leave Chat',
            destructive: true,
            onPress: handleLeaveConfirm,
          },
        ]}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  centeredFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 32,
  },
  errorLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.error,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
    marginTop: 80,
  },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyBody: {
    fontSize: 15,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
