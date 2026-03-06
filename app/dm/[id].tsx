// app/dm/[id].tsx — Private DM Chat Screen
// Navigated to from: user/[id].tsx "Message" button.
// Channel ID format: dm_{sortedUserId1}_{sortedUserId2}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import type { Channel as StreamChannel } from 'stream-chat';

import { streamClient } from '../../lib/streamClient';
import { useBlockedUsers } from '../../hooks/useBlockedUsers';
import { Colors, STREAM_THEME } from '../../constants/theme';
import { styles } from '../../styles/eventChatStyles';

export default function DMChatScreen() {
  const { id: channelId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<StreamChannel | null>(null);

  // ── Blocked users — hide their messages ──────────────────────────────────
  const blockedUserIds = useBlockedUsers();
  const BlockFilteredMessage = useCallback(
    (props: any) => {
      if (blockedUserIds.size > 0 && blockedUserIds.has(props.message?.user?.id)) {
        return null;
      }
      return <MessageSimple {...props} />;
    },
    [blockedUserIds],
  );

  useEffect(() => {
    if (!channelId || !streamClient.userID) {
      setError('Chat is not connected.');
      setIsConnecting(false);
      return;
    }

    let cancelled = false;

    const setup = async () => {
      try {
        const ch = streamClient.channel('messaging', channelId);
        await ch.watch();

        if (cancelled) {
          ch.stopWatching().catch(() => {});
          return;
        }

        channelRef.current = ch;
        setChannel(ch);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load chat.');
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
  }, [channelId]);

  // Derive the other person's name from channel members
  const otherMember = channel
    ? Object.values(channel.state.members).find(m => m.user_id !== streamClient.userID)
    : null;
  const headerName = otherMember?.user?.name ?? (channel?.data?.name as string) ?? 'Chat';

  if (isConnecting) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
        <View style={styles.centeredFill}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Opening chat...</Text>
        </View>
      </View>
    );
  }

  if (error || !channel) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
        <View style={styles.centeredFill}>
          <Text style={styles.errorLabel}>Connection Failed</Text>
          <Text style={styles.errorText}>{error ?? 'Could not load chat.'}</Text>
          <Pressable style={styles.goBackBtn} onPress={() => router.back()}>
            <Text style={styles.goBackBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
      {/* Header */}
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
          {headerName}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Chat */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'android' ? 'height' : undefined}
        keyboardVerticalOffset={Platform.OS === 'android' ? insets.top + 56 : 0}
      >
        <Chat client={streamClient} style={STREAM_THEME}>
          <Channel
            channel={channel}
            disableKeyboardCompatibleView={Platform.OS === 'android'}
            Message={BlockFilteredMessage}
          >
            <MessageList />
            <View style={{ paddingBottom: insets.bottom }}>
              <MessageInput />
            </View>
          </Channel>
        </Chat>
      </KeyboardAvoidingView>
    </View>
  );
}
