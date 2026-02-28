import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChannelList, Chat, OverlayProvider } from 'stream-chat-expo';
import type { Channel } from 'stream-chat';

import { streamClient } from '../../lib/streamClient';
import { useAuthStore } from '../../stores/authStore';

// ─── Stream dark theme ────────────────────────────────────────────────────────
// Overrides the Stream default (white) palette to match the app's dark slate UI.

const STREAM_THEME = {
  colors: {
    // Backgrounds
    white: '#0F172A',
    white_snow: '#0F172A',
    bg_gradient_start: '#0F172A',
    bg_gradient_end: '#0F172A',
    // Borders / dividers
    grey_gainsboro: '#1E293B',
    grey_whisper: '#1E293B',
    // Text
    black: '#F8FAFC',
    grey: '#64748B',
    grey_dark: '#94A3B8',
    // Accent — keep Stream's blue close to our electric blue
    accentBlue: '#3B82F6',
  },
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatsScreen() {
  const router = useRouter();
  const { user, profile, streamToken } = useAuthStore();

  // If the client is already connected (e.g. user came back from a chat room),
  // skip the connecting state entirely.
  const [isConnecting, setIsConnecting] = useState(!streamClient.userID);
  const [connectError, setConnectError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // ── 5-second timeout: surface the error instead of spinning forever ────────

  useEffect(() => {
    if (!isConnecting) return;
    const t = setTimeout(() => {
      if (!cancelledRef.current) {
        setIsConnecting(false);
        setConnectError(
          streamToken
            ? 'Stream connection timed out. Check your EXPO_PUBLIC_STREAM_API_KEY value.'
            : 'Stream token is null after 5 s. Check that:\n• generate-stream-token is deployed\n• STREAM_SECRET_KEY is set in Supabase secrets\n• The Edge Function logs show no errors',
        );
      }
    }, 5_000);
    return () => clearTimeout(t);
  }, [isConnecting, streamToken]);

  // ── Connect Stream client ─────────────────────────────────────────────────

  useEffect(() => {
    cancelledRef.current = false;

    // Already connected — nothing to do.
    if (streamClient.userID) {
      setIsConnecting(false);
      return;
    }

    // Token missing — fail immediately with a diagnosable message.
    if (!streamToken) {
      console.warn('[Chats] streamToken is null.',
        '| user:', user?.id ?? 'none',
        '| profile.display_name:', profile?.display_name ?? 'none',
      );
      // Don't fail yet — the timeout above will surface the error after 5 s
      // if the token still hasn't arrived (giving the root layout time to fetch it).
      return;
    }

    if (!user || !profile) return;

    console.log('[Chats] connectUser → userID:', user.id);

    let cancelled = false;

    const connect = async () => {
      try {
        await streamClient.connectUser(
          {
            id: user.id,
            name: profile.display_name ?? undefined,
            image: profile.avatar_url ?? undefined,
          },
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

  // ── Channel selection → route to event chat ───────────────────────────────

  const handleSelectChannel = (channel: Channel) => {
    // All our channels are named `event_<uuid>` — strip the prefix.
    const eventId = channel.id?.replace(/^event_/, '');
    if (eventId) router.push(`/event/${eventId}`);
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isConnecting) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header />
        <View style={styles.centeredFill}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (connectError || !user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header />
        <View style={styles.centeredFill}>
          <Text style={styles.errorLabel}>⚠️ Connection Failed</Text>
          <Text style={styles.errorText}>
            {connectError ?? 'Not signed in.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header />

      {/*
       * OverlayProvider wraps here so the image lightbox and reactions work
       * inside ChannelList previews. For cross-screen support, move it to
       * app/_layout.tsx in Phase 4.
       */}
      <OverlayProvider value={{ style: STREAM_THEME }}>
        <Chat client={streamClient} style={STREAM_THEME}>
          <ChannelList
            filters={{
              // Only show channels this user is a member of
              type: 'messaging',
              members: { $in: [user.id] },
            }}
            sort={{ last_message_at: -1 }}
            onSelect={handleSelectChannel}
            // Custom empty state shown when the user has no conversations yet
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

// ─── Header ───────────────────────────────────────────────────────────────────

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Messages</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
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
    color: '#EF4444',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'monospace',
  },
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
    marginTop: 80,
  },
  emptyEmoji: {
    fontSize: 52,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  emptyBody: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
});
