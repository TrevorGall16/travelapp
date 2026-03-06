// app/notifications.tsx — Real-time Notification Hub
// Types: friend_request (Accept/Ignore), request_accepted, event_invite, system

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Bell, Check, ChevronLeft, X } from 'lucide-react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import { acceptConnectionRequest, removeConnection } from '../lib/social';
import { useAuthStore } from '../stores/authStore';
import { Colors, Radius, Spacing } from '../constants/theme';

// ── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: 'friend_request' | 'request_accepted' | 'event_invite' | 'system';
  from_user_id: string | null;
  event_id: string | null;
  body: string | null;
  read: boolean;
  created_at: string;
  // Joined from profiles (from_user_id)
  from_user?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

function relativeTime(date: string): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ── Fetch initial notifications ──────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id, type, from_user_id, event_id, body, read, created_at,
        from_user:profiles!notifications_from_user_id_fkey(display_name, avatar_url)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setNotifications(data as unknown as Notification[]);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ── Real-time subscription ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const row = payload.new as Notification;

          // Fetch the sender's profile for display
          if (row.from_user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('id', row.from_user_id)
              .single();

            if (profile) {
              row.from_user = profile;
            }
          }

          setNotifications((prev) => [row, ...prev]);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);

  // ── Mark all as read on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    // Fire-and-forget — mark unread notifications as read
    supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .then(() => {});
  }, [user]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAccept = async (notif: Notification) => {
    if (!user || !notif.from_user_id) return;

    setProcessingIds((prev) => new Set(prev).add(notif.id));
    const result = await acceptConnectionRequest(user.id, notif.from_user_id);

    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Update the notification type locally to show "connected" state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notif.id ? { ...n, type: 'request_accepted' as const } : n,
        ),
      );
    }
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(notif.id);
      return next;
    });
  };

  const handleIgnore = async (notif: Notification) => {
    if (!user || !notif.from_user_id) return;

    setProcessingIds((prev) => new Set(prev).add(notif.id));
    await removeConnection(user.id, notif.from_user_id);

    // Remove from list
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id));

    // Delete the notification row
    supabase.from('notifications').delete().eq('id', notif.id).then(() => {});
  };

  // ── Render row ───────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Notification }) => {
    const senderName = item.from_user?.display_name ?? 'Someone';
    const avatarUrl = item.from_user?.avatar_url;
    const isProcessing = processingIds.has(item.id);

    let message = '';
    switch (item.type) {
      case 'friend_request':
        message = `${senderName} wants to connect.`;
        break;
      case 'request_accepted':
        message = `You and ${senderName} are now connected!`;
        break;
      case 'event_invite':
        message = item.body ?? `${senderName} invited you to an event.`;
        break;
      case 'system':
        message = item.body ?? 'System notification.';
        break;
    }

    return (
      <Pressable
        style={({ pressed }) => [
          styles.row,
          !item.read && styles.rowUnread,
          pressed && styles.rowPressed,
        ]}
        onPress={() => {
          if (item.from_user_id && item.type !== 'system') {
            router.push(`/user/${item.from_user_id}`);
          }
        }}
      >
        {/* Avatar */}
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarEmoji}>
              {item.type === 'friend_request' ? '👋' : item.type === 'request_accepted' ? '🤝' : '🔔'}
            </Text>
          </View>
        )}

        {/* Content */}
        <View style={styles.body}>
          <Text style={styles.message}>{message}</Text>
          <Text style={styles.time}>{relativeTime(item.created_at)}</Text>

          {/* Action buttons for friend requests */}
          {item.type === 'friend_request' && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => handleAccept(item)}
                disabled={isProcessing}
                activeOpacity={0.8}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <>
                    <Check size={14} color={Colors.white} strokeWidth={3} />
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.ignoreBtn}
                onPress={() => handleIgnore(item)}
                disabled={isProcessing}
                activeOpacity={0.8}
              >
                <X size={14} color={Colors.textSecondary} strokeWidth={2.5} />
                <Text style={styles.ignoreBtnText}>Ignore</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  // ── Screen ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.flex}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.5} />
          <Text style={styles.backLabel}>Map</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerRight} />
      </View>

      {isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.iconWrap}>
            <Bell size={36} color={Colors.textTertiary} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>Nothing right now</Text>
          <Text style={styles.emptyBody}>
            When someone sends you a connection request or invites you to an event, it'll show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backLabel: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerRight: {
    flex: 1,
  },

  // List
  list: {
    paddingTop: Spacing.sm,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: Colors.background,
  },
  rowUnread: {
    backgroundColor: Colors.accentMuted,
  },
  rowPressed: {
    backgroundColor: Colors.surface,
  },

  // Avatar
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
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarEmoji: { fontSize: 22 },

  // Body
  body: {
    flex: 1,
    gap: 4,
  },
  message: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  time: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },

  // Action buttons (friend request)
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.accent,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  acceptBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  ignoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ignoreBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
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
