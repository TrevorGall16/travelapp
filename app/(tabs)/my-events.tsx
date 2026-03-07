import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { differenceInMinutes } from 'date-fns';

import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { EventCategory } from '../../types';
import { CATEGORY_EMOJI } from '../../constants/categories';
import { Colors, Radius, Shadows, Spacing } from '../../constants/theme';
import { ActionModal, ConfirmModal } from '../../components/ActionModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventRow {
  id: string;
  title: string;
  category: EventCategory;
  status: 'active' | 'expired';
  expires_at: string;
  host_id: string;
  participant_count: number;
  host_display_name: string | null;
  host_avatar_url: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countdownInfo(expiresAt: string): { label: string; color: string } {
  const mins = differenceInMinutes(new Date(expiresAt), new Date());
  if (mins <= 0) return { label: 'Ended', color: Colors.textTertiary };
  if (mins < 60) return { label: `${mins}m left`, color: Colors.error };
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 3) return { label: m ? `${h}h ${m}m left` : `${h}h left`, color: Colors.warning };
  return { label: `${h}h left`, color: Colors.success };
}

// ─── Event Row ────────────────────────────────────────────────────────────────

function EventRowItem({
  item,
  currentUserId,
  onLongPress,
}: {
  item: EventRow;
  currentUserId: string;
  onLongPress: (item: EventRow, isHost: boolean) => void;
}) {
  const router = useRouter();
  const countdown = countdownInfo(item.expires_at);
  const isHost = item.host_id === currentUserId;
  const isExpired = item.status === 'expired';

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => router.push(`/event/${item.id}`)}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onLongPress(item, isHost);
      }}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`Open chat for ${item.title}`}
    >
      {/* Category emoji circle */}
      <View style={[styles.emojiCircle, isExpired && styles.emojiCircleDim]}>
        <Text style={styles.emoji}>{CATEGORY_EMOJI[item.category] ?? '📍'}</Text>
      </View>

      {/* Text block */}
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text
            style={[styles.title, isExpired && styles.titleDim]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={[styles.countdownLabel, { color: countdown.color }]}>
            {countdown.label}
          </Text>
        </View>

        <View style={styles.rowMeta}>
          {item.host_avatar_url ? (
            <Image
              source={{ uri: item.host_avatar_url }}
              style={styles.hostAvatar}
              contentFit="cover"
            />
          ) : (
            <View style={styles.hostAvatarFallback} />
          )}
          <Text style={styles.hostName} numberOfLines={1}>
            {item.host_display_name ?? 'Unknown host'}
          </Text>
          {isHost && (
            <View style={styles.hostBadge}>
              <Text style={styles.hostBadgeText}>Host</Text>
            </View>
          )}
          <Text style={styles.participantCount}>· 👥 {item.participant_count}</Text>
        </View>
      </View>

      <Text style={[styles.chevron, isExpired && styles.chevronDim]}>›</Text>
    </Pressable>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function MyEventsScreen() {
  const { user } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeEvents, setActiveEvents] = useState<EventRow[]>([]);
  const [pastEvents, setPastEvents] = useState<EventRow[]>([]);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Data fetch ─────────────────────────────────────────────────────────

  const fetchMyEvents = useCallback(async () => {
    if (!user) return;

    try {
      const { data: participantRows, error: partError } = await supabase
        .from('event_participants')
        .select('event_id')
        .eq('user_id', user.id);

      if (partError) throw partError;

      if (!participantRows || participantRows.length === 0) {
        if (!isMountedRef.current) return;
        setActiveEvents([]);
        setPastEvents([]);
        return;
      }

      const eventIds = participantRows.map(
        (r: { event_id: string }) => r.event_id,
      );

      const { data: eventRows, error: eventError } = await supabase
        .from('events')
        .select('id, title, category, status, expires_at, host_id, participant_count')
        .in('id', eventIds)
        .order('expires_at', { ascending: true });

      if (eventError) throw eventError;

      if (!eventRows || eventRows.length === 0) {
        if (!isMountedRef.current) return;
        setActiveEvents([]);
        setPastEvents([]);
        return;
      }

      const hostIds = [
        ...new Set(eventRows.map((e: { host_id: string }) => e.host_id)),
      ];
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', hostIds);

      const profileMap = new Map(
        (profileRows ?? []).map(
          (p: { id: string; display_name: string | null; avatar_url: string | null }) =>
            [p.id, p],
        ),
      );

      const combined: EventRow[] = (
        eventRows as Array<{
          id: string;
          title: string;
          category: EventCategory;
          status: 'active' | 'expired';
          expires_at: string;
          host_id: string;
          participant_count: number;
        }>
      ).map((e) => ({
        ...e,
        host_display_name: profileMap.get(e.host_id)?.display_name ?? null,
        host_avatar_url: profileMap.get(e.host_id)?.avatar_url ?? null,
      }));

      if (!isMountedRef.current) return;
      setActiveEvents(combined.filter((e) => e.status === 'active'));
      setPastEvents(combined.filter((e) => e.status === 'expired').reverse());
    } catch (err) {
      console.error('[MyEvents] fetch error:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchMyEvents();
    }, [fetchMyEvents]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchMyEvents();
  }, [fetchMyEvents]);

  // ── Long-press modal state ──────────────────────────────────────────────
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EventRow | null>(null);
  const [selectedIsHost, setSelectedIsHost] = useState(false);

  const handleLongPress = useCallback(
    (item: EventRow, isHost: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedItem(item);
      setSelectedIsHost(isHost);
      setActionModalVisible(true);
    },
    [],
  );

  const handleActionPress = useCallback(() => {
    setActionModalVisible(false);
    if (selectedIsHost) {
      // Host delete → show double-confirm
      setConfirmModalVisible(true);
    } else {
      // Participant leave → execute immediately
      (async () => {
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
              body: JSON.stringify({ event_id: selectedItem?.id }),
            },
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Leave failed.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          fetchMyEvents();
        } catch (err) {
          Alert.alert('Error', err instanceof Error ? err.message : 'Could not leave event.');
        }
      })();
    }
  }, [selectedItem, selectedIsHost, fetchMyEvents]);

  const handleConfirmDelete = useCallback(async () => {
    setConfirmModalVisible(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { Alert.alert('Session Expired'); return; }
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-event`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ event_id: selectedItem?.id }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchMyEvents();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not delete event.');
    }
  }, [selectedItem, fetchMyEvents]);

  // ── Section data ───────────────────────────────────────────────────────

  const sections = useMemo(() => {
    const result: Array<{ title: string; data: EventRow[] }> = [];
    if (activeEvents.length > 0) result.push({ title: 'ACTIVE', data: activeEvents });
    if (pastEvents.length > 0) result.push({ title: 'PAST', data: pastEvents });
    return result;
  }, [activeEvents, pastEvents]);

  const isEmpty =
    !isLoading && activeEvents.length === 0 && pastEvents.length === 0;

  // ── Loading ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>My Events</Text>
        </View>
        <View style={styles.centeredFill}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────

  if (isEmpty) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>My Events</Text>
        </View>
        <View style={styles.centeredFill}>
          <Text style={styles.emptyEmoji}>🗺️</Text>
          <Text style={styles.emptyTitle}>No events yet</Text>
          <Text style={styles.emptyBody}>
            Tap a pin on the map to join an event, or create your own with the
            {' '}+ button.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── List ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>My Events</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <EventRowItem item={item} currentUserId={user?.id ?? ''} onLongPress={handleLongPress} />
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
        contentContainerStyle={styles.listContent}
      />

      <ActionModal
        visible={actionModalVisible}
        onClose={() => setActionModalVisible(false)}
        title={selectedItem?.title ?? ''}
        subtitle={selectedIsHost ? 'You are the host of this event.' : 'You are a participant in this event.'}
        actions={[
          {
            label: selectedIsHost ? 'Delete Event' : 'Leave Event',
            destructive: true,
            onPress: handleActionPress,
          },
        ]}
      />

      <ConfirmModal
        visible={confirmModalVisible}
        onClose={() => setConfirmModalVisible(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Event?"
        body="This action is permanent. Are you sure?"
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

  // Header
  header: {
    paddingHorizontal: Spacing.xl,
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

  // Utility
  centeredFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
    gap: Spacing.md,
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1.2,
  },

  // List
  listContent: {
    paddingBottom: Spacing.xxxl,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSubtle,
    marginLeft: 80,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    gap: 14,
  },
  rowPressed: {
    backgroundColor: Colors.surface,
  },
  emojiCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emojiCircleDim: {
    opacity: 0.4,
  },
  emoji: {
    fontSize: 22,
  },
  rowBody: {
    flex: 1,
    gap: 6,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  titleDim: {
    color: Colors.textTertiary,
  },
  countdownLabel: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 0,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hostAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.border,
  },
  hostAvatarFallback: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.border,
  },
  hostName: {
    fontSize: 13,
    color: Colors.textTertiary,
    flexShrink: 1,
    fontWeight: '500',
  },
  hostBadge: {
    backgroundColor: Colors.accentMuted,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hostBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 0.3,
  },
  participantCount: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 22,
    color: Colors.border,
    lineHeight: 26,
  },
  chevronDim: {
    opacity: 0.35,
  },

  // Empty state
  emptyEmoji: {
    fontSize: 52,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  emptyBody: {
    fontSize: 15,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
