// app/user/[id].tsx — Public User Profile
// Navigated to from: EventCard participant strip, Group Chat member directory, etc.

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ChevronLeft } from 'lucide-react-native';

import { supabase } from '../../lib/supabase';
import { COUNTRIES } from '../../constants/countries';
import { Colors } from '../../constants/theme';
import type { Profile } from '../../types/index';

const AVATAR_SIZE = 120;
const AVATAR_RING = 3;

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); setIsLoading(false); return; }

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, display_name, avatar_url, bio, instagram_handle, country_code, ' +
          'verification_status, events_hosted_count, travel_styles, languages, visited_countries'
        )
        .eq('id', id)
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setProfile(data as Profile);
      }
      setIsLoading(false);
    };

    fetchProfile();
  }, [id]);

  // ── Derived display data ────────────────────────────────────────────────────
  const homeCountry = COUNTRIES.find(c => c.code === profile?.country_code);

  const visitedData = (profile?.visited_countries ?? [])
    .map(code => COUNTRIES.find(c => c.code === code))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);

  const hasTravelStyles = (profile?.travel_styles?.length ?? 0) > 0;
  const hasLanguages = (profile?.languages?.length ?? 0) > 0;
  const hasVisited = visitedData.length > 0;

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.5} />
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centeredFill}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Not found ───────────────────────────────────────────────────────────────
  if (notFound || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.5} />
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centeredFill}>
          <Text style={styles.notFoundEmoji}>👤</Text>
          <Text style={styles.notFoundTitle}>User not found</Text>
          <Text style={styles.notFoundSub}>This profile may have been removed.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.5} />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === 'android' ? 100 : insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.avatarRing}>
            {profile.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {profile.display_name?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.displayName}>{profile.display_name}</Text>

          {homeCountry ? (
            <Text style={styles.countryLine}>
              {homeCountry.flag}{'  '}{homeCountry.name}
            </Text>
          ) : null}

          {profile.verification_status === 'verified' ? (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓ Verified Traveler</Text>
            </View>
          ) : null}
        </View>

        {/* ── About ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>

          {profile.bio ? (
            <Text style={styles.bioText}>{profile.bio}</Text>
          ) : (
            <Text style={styles.emptyText}>No bio yet.</Text>
          )}

          {profile.instagram_handle ? (
            <View style={styles.igRow}>
              <Text style={styles.igIcon}>📸</Text>
              <Text style={styles.igHandle}>@{profile.instagram_handle}</Text>
            </View>
          ) : null}

          {(profile.events_hosted_count ?? 0) > 0 ? (
            <View style={styles.igRow}>
              <Text style={styles.igIcon}>🗺️</Text>
              <Text style={styles.statsText}>
                {profile.events_hosted_count} {profile.events_hosted_count === 1 ? 'event' : 'events'} hosted
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Travel Style ── */}
        {hasTravelStyles ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Travel Style</Text>
            <View style={styles.tagRow}>
              {profile.travel_styles.map(style => (
                <View key={style} style={styles.accentTag}>
                  <Text style={styles.accentTagText}>{style}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Languages ── */}
        {hasLanguages ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Languages</Text>
            <View style={styles.tagRow}>
              {profile.languages.map(lang => (
                <View key={lang} style={styles.neutralTag}>
                  <Text style={styles.neutralTagText}>{lang}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Countries Visited ── */}
        {hasVisited ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Countries Visited</Text>
            <Text style={styles.visitedCount}>
              {visitedData.length} {visitedData.length === 1 ? 'country' : 'countries'}
            </Text>
            <View style={styles.tagRow}>
              {visitedData.map(c => (
                <View key={c.code} style={styles.countryTag}>
                  <Text style={styles.countryTagFlag}>{c.flag}</Text>
                  <Text style={styles.countryTagName}>{c.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Empty state ── */}
        {!profile.bio && !hasTravelStyles && !hasLanguages && !hasVisited ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>
              This traveler hasn't filled in their profile yet.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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

  // ── States ────────────────────────────────────────────────────────────────
  centeredFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 48,
  },
  notFoundEmoji: {
    fontSize: 52,
    marginBottom: 4,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  notFoundSub: {
    fontSize: 14,
    color: Colors.textTertiary,
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 16,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  avatarRing: {
    width: AVATAR_SIZE + AVATAR_RING * 2 + 4,
    height: AVATAR_SIZE + AVATAR_RING * 2 + 4,
    borderRadius: (AVATAR_SIZE + AVATAR_RING * 2 + 4) / 2,
    borderWidth: AVATAR_RING,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 44,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  displayName: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  countryLine: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  verifiedBadge: {
    backgroundColor: Colors.accentSubtle,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 2,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent,
  },

  // ── Cards ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  bioText: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 23,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  igRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  igIcon: {
    fontSize: 15,
  },
  igHandle: {
    fontSize: 15,
    color: Colors.accent,
    fontWeight: '500',
  },
  statsText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  visitedCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: -4,
  },

  // ── Tags ───────────────────────────────────────────────────────────────────
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accentTag: {
    backgroundColor: Colors.accentSubtle,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  accentTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent,
  },
  neutralTag: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  neutralTagText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  countryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  countryTagFlag: {
    fontSize: 14,
  },
  countryTagName: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
    alignItems: 'center',
  },
  emptyCardText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
