import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Animated, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Compass, Users } from 'lucide-react-native';
import { COUNTRIES } from '../../constants/countries';
import { Colors, Radius, Shadows, Spacing } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { forceGlobalSignOut } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useFocusEffect } from 'expo-router';

const AVATAR_SIZE = 110;

export default function ProfileScreen() {
  const { profile, user } = useAuthStore();
  const insets = useSafeAreaInsets();

  const country = COUNTRIES.find(c => c.code === profile?.country_code);

  const [connections, setConnections] = useState(0);

  // ── Fade-in entrance animation ──────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      (async () => {
        try {
          const { data: myEvents } = await supabase
            .from('event_participants')
            .select('event_id')
            .eq('user_id', user.id);
          if (!myEvents || myEvents.length === 0) { setConnections(0); return; }

          const eventIds = myEvents.map(r => r.event_id);

          const { data: others } = await supabase
            .from('event_participants')
            .select('user_id')
            .in('event_id', eventIds)
            .neq('user_id', user.id);

          const unique = new Set(others?.map(r => r.user_id) ?? []);
          setConnections(unique.size);
        } catch { /* non-critical */ }
      })();
    }, [user]),
  );

  const activitiesCount = profile?.events_hosted_count ?? 0;
  const countriesCount = profile?.visited_countries?.length || 1;

  const STATS = [
    { value: String(activitiesCount), label: 'Activities', icon: Compass, color: Colors.accent },
    { value: String(connections), label: 'Connections', icon: Users, color: Colors.success },
    { value: String(countriesCount), label: 'Countries', icon: MapPin, color: Colors.warning },
  ];

  const handleLogout = forceGlobalSignOut;

  return (
    <Animated.View style={[styles.scroll, { opacity: fadeAnim }]}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 48 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero ── */}
      <View style={styles.hero}>
        <TouchableOpacity onPress={() => router.push('/profile/preview')} activeOpacity={0.85}>
          <View style={styles.avatarOuter}>
            <View style={styles.avatarRing}>
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>
                    {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        <Text style={styles.displayName}>{profile?.display_name ?? 'Traveler'}</Text>

        {country ? (
          <View style={styles.countryPill}>
            <Text style={styles.countryFlag}>{country.flag}</Text>
            <Text style={styles.countryName}>{country.name}</Text>
          </View>
        ) : null}
      </View>

      {/* ── Stats Row — Premium ── */}
      <View style={styles.statsRow}>
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <View key={stat.label} style={styles.statCard}>
              <View style={[styles.statIconCircle, { backgroundColor: stat.color + '18' }]}>
                <Icon size={18} color={stat.color} strokeWidth={2.5} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          );
        })}
      </View>

      {/* ── About ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>About</Text>

        {profile?.bio ? (
          <Text style={styles.bioText}>{profile.bio}</Text>
        ) : (
          <Text style={styles.bioPlaceholder}>
            No bio yet. Say something — even "I like tacos" works.
          </Text>
        )}

        {profile?.instagram_handle ? (
          <View style={styles.igRow}>
            <Text style={styles.igIcon}>📸</Text>
            <Text style={styles.igHandle}>@{profile.instagram_handle}</Text>
          </View>
        ) : null}
      </View>

      {/* ── Actions ── */}
      <View style={styles.actionsCard}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/profile/edit');
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.actionLabel}>Edit Profile</Text>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>

        <View style={styles.actionDivider} />

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => router.push('/profile/settings')}
          activeOpacity={0.7}
        >
          <Text style={styles.actionLabel}>Settings</Text>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Log Out ── */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      {/* ── Developer Reset ── */}
      <TouchableOpacity style={styles.devResetButton} onPress={forceGlobalSignOut} activeOpacity={0.8}>
        <Text style={styles.devResetText}>Developer Reset (Clear All Cache)</Text>
      </TouchableOpacity>
    </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },

  // ── Hero ──────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  avatarOuter: {
    padding: 3,
    borderRadius: (AVATAR_SIZE + 12) / 2,
    backgroundColor: Colors.accentGlow,
  },
  avatarRing: {
    width: AVATAR_SIZE + 6,
    height: AVATAR_SIZE + 6,
    borderRadius: (AVATAR_SIZE + 6) / 2,
    borderWidth: 3,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 42,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  displayName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginTop: Spacing.sm,
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countryFlag: {
    fontSize: 16,
  },
  countryName: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  // ── Stats — Premium individual cards ───────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    gap: 6,
    ...Shadows.card,
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // ── About card ────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  bioText: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  bioPlaceholder: {
    fontSize: 15,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  igRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  igIcon: {
    fontSize: 15,
  },
  igHandle: {
    fontSize: 15,
    color: Colors.accent,
    fontWeight: '600',
  },

  // ── Actions ───────────────────────────────────────────────
  actionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 18,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  actionChevron: {
    fontSize: 22,
    color: Colors.textTertiary,
    lineHeight: 24,
  },
  actionDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.xl,
  },

  // ── Log Out ───────────────────────────────────────────────
  logoutButton: {
    backgroundColor: Colors.errorBackground,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.errorLight,
  },

  // ── Developer Reset ───────────────────────────────────────
  devResetButton: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
  },
  devResetText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textTertiary,
  },
});
