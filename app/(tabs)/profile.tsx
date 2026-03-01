import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COUNTRIES } from '../../constants/countries';
import { Colors } from '../../constants/theme';
import { streamClient } from '../../lib/streamClient';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

const AVATAR_SIZE = 120;
const AVATAR_RING = 3;

const STATS = [
  { value: '0', label: 'Activities' },
  { value: '0', label: 'Connections' },
  { value: '1', label: 'Country' },
] as const;

export default function ProfileScreen() {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();

  const country = COUNTRIES.find(c => c.code === profile?.country_code);

  const handleLogout = async () => {
    if (streamClient.userID) {
      await streamClient.disconnectUser();
    }
    await supabase.auth.signOut();
    // root layout auth guard handles navigation
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 48 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero ── */}
      <View style={styles.hero}>
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

        <Text style={styles.displayName}>{profile?.display_name ?? 'Traveler'}</Text>

        {country ? (
          <Text style={styles.countryLine}>
            {country.flag}{'  '}{country.name}
          </Text>
        ) : null}
      </View>

      {/* ── Stats Row ── */}
      <View style={styles.statsCard}>
        {STATS.map((stat, i) => (
          <View
            key={stat.label}
            style={[styles.statItem, i < STATS.length - 1 && styles.statBorder]}
          >
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* ── About ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>About</Text>

        {profile?.bio ? (
          <Text style={styles.bioText}>{profile.bio}</Text>
        ) : (
          <Text style={styles.bioPlaceholder}>
            Add a bio to let other travelers know who you are.
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
          onPress={() => console.log('Edit Profile')}
          activeOpacity={0.7}
        >
          <Text style={styles.actionLabel}>Edit Profile</Text>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>

        <View style={styles.actionDivider} />

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => console.log('Settings')}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },

  // ── Hero ──────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
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
    marginTop: 6,
  },
  countryLine: {
    fontSize: 15,
    color: Colors.textSecondary,
  },

  // ── Stats ─────────────────────────────────────────────────
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 22,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  statBorder: {
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },

  // ── About card ────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 10,
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
    lineHeight: 23,
  },
  bioPlaceholder: {
    fontSize: 15,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    lineHeight: 23,
  },
  igRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  igIcon: {
    fontSize: 15,
  },
  igHandle: {
    fontSize: 15,
    color: Colors.accent,
    fontWeight: '500',
  },

  // ── Actions ───────────────────────────────────────────────
  actionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
    marginHorizontal: 20,
  },

  // ── Log Out ───────────────────────────────────────────────
  logoutButton: {
    backgroundColor: Colors.errorBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.errorLight,
  },
});
