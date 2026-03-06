import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, X } from 'lucide-react-native';
import { COUNTRIES } from '../../constants/countries';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import Gallery from '../../components/profile/Gallery';

const AVATAR_SIZE = 108;
const AVATAR_RING = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const GALLERY_THUMB = (SCREEN_WIDTH - 40 - 8) / 2; // 2-col grid with 8px gap

export default function ProfilePreviewScreen() {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const homeCountry = COUNTRIES.find(c => c.code === profile?.country_code);
  const photoUrls = profile?.photo_urls ?? [];

  const visitedData = (profile?.visited_countries ?? [])
    .map(code => COUNTRIES.find(c => c.code === code))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);

  const hasPersonaTags = (profile?.persona_tags?.length ?? 0) > 0;
  const hasTravelStyles = (profile?.travel_styles?.length ?? 0) > 0;
  const hasLanguages = (profile?.languages?.length ?? 0) > 0;
  const hasVisited = visitedData.length > 0;
  const hasPhotos = photoUrls.length > 0;

  return (
    <View style={styles.flex}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.5} />
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

          {homeCountry ? (
            <Text style={styles.countryLine}>
              {homeCountry.flag}{'  '}{homeCountry.name}
            </Text>
          ) : null}
        </View>

        {/* ── Photo Gallery (Tactile swipe) ── */}
        {hasPhotos ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Photos</Text>
            <Gallery photos={photoUrls} />
          </View>
        ) : null}

        {/* ── About ── */}
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

        {/* ── Persona Tags ── */}
        {hasPersonaTags ? (
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
        ) : null}

        {/* ── Travel Style ── */}
        {hasTravelStyles ? (
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
        ) : null}

        {/* ── Languages ── */}
        {hasLanguages ? (
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
        ) : null}

        {/* ── Countries Visited ── */}
        {hasVisited ? (
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
        ) : null}

        {/* ── Empty state ── */}
        {!profile?.bio && !hasPersonaTags && !hasTravelStyles && !hasLanguages && !hasVisited && !hasPhotos ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>
              Pretty blank so far.{'\n'}Hit Edit Profile to fill this in.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Full-Screen Photo Preview Modal ── */}
      <Modal
        visible={previewUri !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPreviewUri(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPreviewUri(null)}>
          <View style={[styles.modalCloseRow, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setPreviewUri(null)}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={22} color={Colors.white} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {previewUri && (
            <Image
              source={{ uri: previewUri }}
              style={styles.modalImage}
              contentFit="contain"
            />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Header ──────────────────────────────────────────────────
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
    fontSize: 40,
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

  // ── Photo Gallery ─────────────────────────────────────────────
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  galleryThumb: {
    width: GALLERY_THUMB,
    height: GALLERY_THUMB,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceElevated,
  },

  // ── Cards ────────────────────────────────────────────────────
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
  visitedCount: {
    fontSize: 13,
    color: Colors.textSecondary,
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
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  personaTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent,
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

  // ── Empty state ──────────────────────────────────────────────
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

  // ── Full-screen Preview Modal ────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseRow: {
    position: 'absolute',
    top: 0,
    right: 16,
    zIndex: 10,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
});
