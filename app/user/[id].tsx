// app/user/[id].tsx — Public User Profile
// Navigated to from: EventCard participant strip, Group Chat member directory, etc.

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ChevronLeft, MessageCircle } from 'lucide-react-native';

import { supabase } from '../../lib/supabase';
import { streamClient } from '../../lib/streamClient';
import {
  checkConnectionStatus,
  sendConnectionRequest,
  acceptConnectionRequest,
  type ConnectionStatus,
} from '../../lib/social';
import { useAuthStore } from '../../stores/authStore';
import { COUNTRIES } from '../../constants/countries';
import { useAppTheme, Radius, Shadows, Spacing } from '../../constants/theme';
import type { ThemeColors } from '../../constants/theme';
import type { Profile } from '../../types/index';

const AVATAR_SIZE = 120;
const AVATAR_RING = 3;

/** Build a deterministic DM channel ID from two user IDs (sorted). */
function dmChannelId(a: string, b: string): string {
  const sorted = [a, b].sort();
  return `dm_${sorted[0]}_${sorted[1]}`;
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createLocalStyles(colors), [colors]);
  const { user: currentUser, profile: myProfile } = useAuthStore();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isOpeningDM, setIsOpeningDM] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('none');
  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch connection status
  useEffect(() => {
    if (!currentUser || !id || id === currentUser.id) return;
    checkConnectionStatus(currentUser.id, id).then(setConnectionStatus);
  }, [currentUser, id]);

  const handleConnect = async () => {
    if (!currentUser || !id || isConnecting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsConnecting(true);
    try {
      if (connectionStatus === 'none') {
        const result = await sendConnectionRequest(currentUser.id, id);
        if (result.ok) setConnectionStatus('pending_sent');
        else Alert.alert('Error', result.error ?? 'Could not send request.');
      } else if (connectionStatus === 'pending_received') {
        const result = await acceptConnectionRequest(currentUser.id, id);
        if (result.ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setConnectionStatus('accepted');
        } else {
          Alert.alert('Error', result.error ?? 'Could not accept request.');
        }
      }
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    if (!id) { setNotFound(true); setIsLoading(false); return; }

    let isMounted = true;

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, display_name, avatar_url, bio, instagram_handle, country_code, ' +
          'verification_status, events_hosted_count, travel_styles, languages, visited_countries'
        )
        .eq('id', id)
        .single();

      if (!isMounted) return;

      if (error || !data) {
        setNotFound(true);
      } else {
        setProfile(data as Profile);
      }
      setIsLoading(false);
    };

    fetchProfile();
    return () => { isMounted = false; };
  }, [id]);

  // ── Open / create DM channel ────────────────────────────────────────────────
  const handleOpenDM = async () => {
    if (!currentUser || !id || !profile || isOpeningDM) return;
    if (id === currentUser.id) return; // can't DM yourself

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOpeningDM(true);

    try {
      if (!streamClient.userID) {
        Alert.alert('Chat Unavailable', 'Chat is still connecting. Try again in a moment.');
        return;
      }

      const channelId = dmChannelId(currentUser.id, id);
      const channel = streamClient.channel('messaging', channelId, {
        members: [currentUser.id, id],
        name: `${myProfile?.display_name ?? 'You'} & ${profile.display_name ?? 'Traveler'}`,
      });

      // watch() creates the channel if it doesn't exist, or joins if it does
      await channel.watch();

      // Navigate to the DM chat — reuse the event chat screen with the channel ID
      router.push(`/dm/${channelId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not open chat.';
      Alert.alert('Error', msg);
    } finally {
      setIsOpeningDM(false);
    }
  };

  const isSelf = currentUser?.id === id;

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
            <ChevronLeft size={20} color={colors.textPrimary} strokeWidth={2.5} />
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centeredFill}>
          <ActivityIndicator size="large" color={colors.accent} />
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
            <ChevronLeft size={20} color={colors.textPrimary} strokeWidth={2.5} />
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
          <ChevronLeft size={20} color={colors.textPrimary} strokeWidth={2.5} />
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

        {/* ── Connection + Message Buttons ── */}
        {!isSelf && (
          <View style={styles.actionRow}>
            {/* Connection handshake button */}
            {connectionStatus === 'accepted' ? (
              <TouchableOpacity
                style={[styles.messageBtn, isOpeningDM && styles.messageBtnLoading]}
                onPress={handleOpenDM}
                disabled={isOpeningDM}
                activeOpacity={0.8}
              >
                {isOpeningDM ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <MessageCircle size={18} color={colors.white} strokeWidth={2.5} />
                    <Text style={styles.messageBtnText}>Message</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.connectBtn,
                  connectionStatus === 'pending_sent' && styles.connectBtnPending,
                  connectionStatus === 'pending_received' && styles.connectBtnAccept,
                  isConnecting && styles.messageBtnLoading,
                ]}
                onPress={handleConnect}
                disabled={isConnecting || connectionStatus === 'pending_sent'}
                activeOpacity={0.8}
              >
                {isConnecting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={[
                    styles.connectBtnText,
                    connectionStatus === 'pending_sent' && styles.connectBtnTextPending,
                  ]}>
                    {connectionStatus === 'none' && 'Connect'}
                    {connectionStatus === 'pending_sent' && 'Sent'}
                    {connectionStatus === 'pending_received' && 'Accept'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

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

const createLocalStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
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
    color: colors.textPrimary,
  },
  notFoundSub: {
    fontSize: 14,
    color: colors.textTertiary,
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
    borderColor: colors.accent,
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
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 44,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  displayName: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  countryLine: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  verifiedBadge: {
    backgroundColor: colors.accentSubtle,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 2,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },

  // ── Action Row (Connect / Message) ──────────────────────────────────────────
  actionRow: {
    gap: 10,
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 14,
    ...Shadows.accentGlow,
  },
  messageBtnLoading: {
    opacity: 0.6,
  },
  messageBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  connectBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 14,
    ...Shadows.accentGlow,
  },
  connectBtnPending: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  connectBtnAccept: {
    backgroundColor: colors.success,
  },
  connectBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  connectBtnTextPending: {
    color: colors.textTertiary,
  },

  // ── Cards ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  bioText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 23,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textTertiary,
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
    color: colors.accent,
    fontWeight: '500',
  },
  statsText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  visitedCount: {
    fontSize: 13,
    color: colors.textSecondary,
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
    backgroundColor: colors.accentSubtle,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  accentTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  neutralTag: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  neutralTagText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  countryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textSecondary,
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    alignItems: 'center',
  },
  emptyCardText: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
