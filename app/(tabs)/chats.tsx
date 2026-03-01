import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ChannelList, Chat, OverlayProvider } from 'stream-chat-expo';
import type { ChannelPreviewUIComponentProps } from 'stream-chat-expo';

import { streamClient } from '../../lib/streamClient';
import { useAuthStore } from '../../stores/authStore';
import { Colors } from '../../constants/theme';

// ─── Stream dark theme ────────────────────────────────────────────────────────

const STREAM_THEME = {
  colors: {
    white: Colors.background,
    white_snow: Colors.background,
    bg_gradient_start: Colors.background,
    bg_gradient_end: Colors.background,
    grey_gainsboro: Colors.border,
    grey_whisper: Colors.surface,
    black: Colors.textPrimary,
    grey: Colors.textTertiary,
    grey_dark: Colors.textSecondary,
    accent_blue: Colors.accent,
  },
};

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

// ─── Custom channel preview row ───────────────────────────────────────────────

function EventChannelPreview(props: ChannelPreviewUIComponentProps) {
  const router = useRouter();
  const { channel, latestMessagePreview, unreadCount } = props;

  const eventId = (channel.id ?? '').replace(/^event_/, '');
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

  return (
    <Pressable
      style={({ pressed }) => [rowStyles.row, pressed && rowStyles.rowPressed]}
      onPress={() => router.push(`/event/${eventId}`)}
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
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 13,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowPressed: {
    backgroundColor: Colors.surface,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.border,
    flexShrink: 0,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarEmoji: { fontSize: 22 },
  body: { flex: 1, gap: 3 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  time: {
    fontSize: 12,
    color: Colors.textTertiary,
    flexShrink: 0,
  },
  preview: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  previewUnread: {
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatsScreen() {
  const { user, profile, streamToken } = useAuthStore();

  const [isConnecting, setIsConnecting] = useState(!streamClient.userID);
  const [connectError, setConnectError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // ── 5-second connection timeout ────────────────────────────────────────────
  useEffect(() => {
    if (!isConnecting) return;
    const t = setTimeout(() => {
      if (!cancelledRef.current) {
        setIsConnecting(false);
        setConnectError(
          streamToken
            ? 'Stream connection timed out. Check your EXPO_PUBLIC_STREAM_API_KEY value.'
            : 'Stream token is null after 5 s. Check that generate-stream-token is deployed and STREAM_SECRET_KEY is set.',
        );
      }
    }, 5_000);
    return () => clearTimeout(t);
  }, [isConnecting, streamToken]);

  // ── Connect Stream client ──────────────────────────────────────────────────
  useEffect(() => {
    cancelledRef.current = false;

    if (streamClient.userID) {
      setIsConnecting(false);
      return;
    }

    if (!streamToken) {
      console.warn('[Chats] streamToken is null.', '| user:', user?.id ?? 'none');
      return; // timeout above will surface the error after 5 s
    }

    if (!user || !profile) return;

    console.log('[Chats] connectUser → userID:', user.id);

    let cancelled = false;

    const connect = async () => {
      try {
        await streamClient.connectUser(
          { id: user.id, name: profile.display_name ?? undefined, image: profile.avatar_url ?? undefined },
          streamToken,
        );
        console.log('[Chats] connectUser succeeded');
        if (!cancelled) setIsConnecting(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Chats] connectUser threw:', msg);
        if (!cancelled) {
          setConnectError(`Stream error: ${msg}`);
          setIsConnecting(false);
        }
      }
    };

    connect();
    return () => {
      cancelled = true;
      cancelledRef.current = true;
    };
  }, [user, profile, streamToken]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isConnecting) {
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

  // ── Error ──────────────────────────────────────────────────────────────────
  if (connectError || !user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Messages</Text>
        </View>
        <View style={styles.centeredFill}>
          <Text style={styles.errorLabel}>⚠️ Connection Failed</Text>
          <Text style={styles.errorText}>{connectError ?? 'Not signed in.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Messages</Text>
      </View>

      <OverlayProvider value={{ style: STREAM_THEME }}>
        <Chat client={streamClient} style={STREAM_THEME}>
          <ChannelList
            filters={{ type: 'messaging', members: { $in: [user.id] } }}
            sort={{ last_message_at: -1 }}
            Preview={EventChannelPreview}
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
      </OverlayProvider>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
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
    fontSize: 13,
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
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyBody: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
