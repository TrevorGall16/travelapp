import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { differenceInMinutes } from 'date-fns';

import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { EventCategory } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ELECTRIC_BLUE = '#3B82F6';

const CATEGORY_EMOJI: Record<EventCategory, string> = {
  beer: '🍺',
  food: '🍜',
  sightseeing: '🏛️',
  adventure: '🧗',
  culture: '🎭',
  other: '📍',
};

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
  if (mins <= 0) return { label: 'Ended', color: '#475569' };
  if (mins < 60) return { label: `${mins}m left`, color: '#EF4444' };
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 3) return { label: m ? `${h}h ${m}m left` : `${h}h left`, color: '#F59E0B' };
  return { label: `${h}h left`, color: '#22C55E' };
}

// ─── Event Row ────────────────────────────────────────────────────────────────

function EventRowItem({
  item,
  currentUserId,
}: {
  item: EventRow;
  currentUserId: string;
}) {
  const router = useRouter();
  const countdown = countdownInfo(item.expires_at);
  const isHost = item.host_id === currentUserId;
  const isExpired = item.status === 'expired';

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => router.push(`/event/${item.id}`)}
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MyEventsScreen() {
  const { user } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeEvents, setActiveEvents] = useState<EventRow[]>([]);
  const [pastEvents, setPastEvents] = useState<EventRow[]>([]);

  // ── Data fetch ───────────────────────────────────────────────────────────

  const fetchMyEvents = useCallback(async () => {
    if (!user) return;

    try {
      // Step 1: get all event IDs the current user is a participant of
      const { data: participantRows, error: partError } = await supabase
        .from('event_participants')
        .select('event_id')
        .eq('user_id', user.id);

      if (partError) throw partError;

      if (!participantRows || participantRows.length === 0) {
        setActiveEvents([]);
        setPastEvents([]);
        return;
      }

      const eventIds = participantRows.map(
        (r: { event_id: string }) => r.event_id,
      );

      // Step 2: fetch the event rows (active first by ascending expiry)
      const { data: eventRows, error: eventError } = await supabase
        .from('events')
        .select('id, title, category, status, expires_at, host_id, participant_count')
        .in('id', eventIds)
        .gte('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true });

      if (eventError) throw eventError;

      if (!eventRows || eventRows.length === 0) {
        setActiveEvents([]);
        setPastEvents([]);
        return;
      }

      // Step 3: fetch host profile snippets for display
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

      // Merge host data onto each event row
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

      // Active: soonest expiry first (already ordered by DB query).
      // Past: flip to most-recently-ended first.
      setActiveEvents(combined.filter((e) => e.status === 'active'));
      setPastEvents(combined.filter((e) => e.status === 'expired').reverse());
    } catch (err) {
      console.error('[MyEvents] fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyEvents();
  }, [fetchMyEvents]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchMyEvents();
  }, [fetchMyEvents]);

  // ── Section data ─────────────────────────────────────────────────────────

  const sections = useMemo(() => {
    const result: Array<{ title: string; data: EventRow[] }> = [];
    if (activeEvents.length > 0) result.push({ title: 'ACTIVE', data: activeEvents });
    if (pastEvents.length > 0) result.push({ title: 'PAST', data: pastEvents });
    return result;
  }, [activeEvents, pastEvents]);

  const isEmpty =
    !isLoading && activeEvents.length === 0 && pastEvents.length === 0;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>My Events</Text>
        </View>
        <View style={styles.centeredFill}>
          <ActivityIndicator size="large" color={ELECTRIC_BLUE} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────

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

  // ── List ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>My Events</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <EventRowItem item={item} currentUserId={user?.id ?? ''} />
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
            tintColor={ELECTRIC_BLUE}
            colors={[ELECTRIC_BLUE]}
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1E293B',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.3,
  },

  // Utility
  centeredFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 1.2,
  },

  // List
  listContent: {
    paddingBottom: 32,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#1E293B',
    marginLeft: 80, // aligns under the title, skips the emoji circle + gap
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  rowPressed: {
    backgroundColor: '#1E293B',
  },
  emojiCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  emojiCircleDim: {
    opacity: 0.4,
  },
  emoji: {
    fontSize: 22,
  },
  rowBody: {
    flex: 1,
    gap: 5,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  titleDim: {
    color: '#64748B',
  },
  countdownLabel: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 0,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hostAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#334155',
  },
  hostAvatarFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#334155',
  },
  hostName: {
    fontSize: 12,
    color: '#64748B',
    flexShrink: 1,
  },
  hostBadge: {
    backgroundColor: '#172554',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  hostBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: ELECTRIC_BLUE,
    letterSpacing: 0.3,
  },
  participantCount: {
    fontSize: 12,
    color: '#475569',
  },
  chevron: {
    fontSize: 22,
    color: '#334155',
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
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 4,
  },
  emptyBody: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
});
