import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { COUNTRIES } from '../../constants/countries';
import { useAppTheme, Radius, Spacing } from '../../constants/theme';
import type { ThemeColors } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import ImageViewer from '../../components/profile/ImageViewer';

const AVATAR_SIZE = 108;
const AVATAR_RING = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const FULL_PHOTO_WIDTH = SCREEN_WIDTH - 40;

// ── Styles ─────────────────────────────────────────────────────────────────

const createLocalStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header ──────────────────────────────────────────────────
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

  // ── Scroll ──────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 16,
  },

  // ── Hero ────────────────────────────────────────────────────
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
    fontSize: 40,
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

  // ── Full-width photo ────────────────────────────────────────
  fullPhoto: {
    width: FULL_PHOTO_WIDTH,
    height: FULL_PHOTO_WIDTH * 0.75,
    borderRadius: Radius.lg,
    backgroundColor: colors.surface,
  },
  remainingPhotos: {
    gap: 16,
  },

  // ── Cards ────────────────────────────────────────────────────
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
  visitedCount: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: -4,
  },

  // ── Tags ────────────────────────────────────────────────────
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  personaTag: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  personaTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
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

  // ── Empty state ──────────────────────────────────────────────
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

// ── Component ──────────────────────────────────────────────────────────────

export default function ProfilePreviewScreen() {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createLocalStyles(colors), [colors]);

  // ── Full-screen image viewer ──────────────────────────────────────────────
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const homeCountry = COUNTRIES.find(c => c.code === profile?.country_code);
  const photoUrls = profile?.photo_urls ?? [];

  // Unified photo list: avatar + gallery
  const allPhotos = useMemo(() => {
    const photos: string[] = [];
    if (profile?.avatar_url) photos.push(profile.avatar_url);
    photos.push(...photoUrls);
    return photos;
  }, [profile?.avatar_url, photoUrls]);

  const openViewer = useCallback((index: number) => {
    if (allPhotos.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewerIndex(index);
    setViewerVisible(true);
  }, [allPhotos.length]);

  // Photo index offset: avatar takes index 0 if it exists
  const photoIndexOffset = profile?.avatar_url ? 1 : 0;

  const visitedData = (profile?.visited_countries ?? [])
    .map(code => COUNTRIES.find(c => c.code === code))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);

  const hasPersonaTags = (profile?.persona_tags?.length ?? 0) > 0;
  const hasTravelStyles = (profile?.travel_styles?.length ?? 0) > 0;
  const hasLanguages = (profile?.languages?.length ?? 0) > 0;
  const hasVisited = visitedData.length > 0;

  return (
    <View style={styles.flex}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={20} color={colors.textPrimary} strokeWidth={2.5} />
          <Text style={styles.backLabel}>Profile</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Public View</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === 'android' ? 100 : insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Circle Avatar (tap → viewer) ── */}
        <View style={styles.hero}>
          <TouchableOpacity onPress={() => openViewer(0)} activeOpacity={0.85}>
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
          </TouchableOpacity>

          <Text style={styles.displayName}>{profile?.display_name ?? 'Traveler'}</Text>

          {homeCountry ? (
            <Text style={styles.countryLine}>
              {homeCountry.flag}{'  '}{homeCountry.name}
            </Text>
          ) : null}
        </View>

        {/* ── 2. Bio ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>

          {profile?.bio ? (
            <Text style={styles.bioText}>{profile.bio}</Text>
          ) : (
            <Text style={styles.emptyText}>No bio yet. The mystery continues.</Text>
          )}

          {profile?.instagram_handle ? (
            <View style={styles.igRow}>
              <Text style={styles.igIcon}>📸</Text>
              <Text style={styles.igHandle}>@{profile.instagram_handle}</Text>
            </View>
          ) : null}
        </View>

        {/* ── 3. First Full Photo ── */}
        {photoUrls.length > 0 && (
          <TouchableOpacity
            onPress={() => openViewer(photoIndexOffset)}
            activeOpacity={0.85}
          >
            <Image
              source={{ uri: photoUrls[0] }}
              style={styles.fullPhoto}
              contentFit="cover"
            />
          </TouchableOpacity>
        )}

        {/* ── 4. Personal Info (Persona + Travel Style) ── */}
        {hasPersonaTags && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Persona</Text>
            <View style={styles.tagRow}>
              {profile!.persona_tags.map(tag => (
                <View key={tag} style={styles.personaTag}>
                  <Text style={styles.personaTagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {hasTravelStyles && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Travel Style</Text>
            <View style={styles.tagRow}>
              {profile!.travel_styles.map(style => (
                <View key={style} style={styles.accentTag}>
                  <Text style={styles.accentTagText}>{style}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 5. Second Photo (interspersed) ── */}
        {photoUrls.length > 1 && (
          <TouchableOpacity
            onPress={() => openViewer(photoIndexOffset + 1)}
            activeOpacity={0.85}
          >
            <Image
              source={{ uri: photoUrls[1] }}
              style={styles.fullPhoto}
              contentFit="cover"
            />
          </TouchableOpacity>
        )}

        {/* ── 6. Languages ── */}
        {hasLanguages && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Languages</Text>
            <View style={styles.tagRow}>
              {profile!.languages.map(lang => (
                <View key={lang} style={styles.neutralTag}>
                  <Text style={styles.neutralTagText}>{lang}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 7. Countries Visited ── */}
        {hasVisited && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Countries Visited</Text>
            <Text style={styles.visitedCount}>{visitedData.length} {visitedData.length === 1 ? 'country' : 'countries'}</Text>
            <View style={styles.tagRow}>
              {visitedData.map(c => (
                <View key={c.code} style={styles.countryTag}>
                  <Text style={styles.countryTagFlag}>{c.flag}</Text>
                  <Text style={styles.countryTagName}>{c.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 8. Remaining Photos ── */}
        {photoUrls.length > 2 && (
          <View style={styles.remainingPhotos}>
            {photoUrls.slice(2).map((uri, i) => (
              <TouchableOpacity
                key={`${uri}-${i}`}
                onPress={() => openViewer(photoIndexOffset + 2 + i)}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri }}
                  style={styles.fullPhoto}
                  contentFit="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Empty state ── */}
        {!profile?.bio && !hasPersonaTags && !hasTravelStyles && !hasLanguages && !hasVisited && photoUrls.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>
              Pretty blank so far.{'\n'}Hit Edit Profile to fill this in.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Full-Screen Image Viewer ── */}
      <ImageViewer
        images={allPhotos}
        initialIndex={viewerIndex}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}
