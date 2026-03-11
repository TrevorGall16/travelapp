import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, X } from 'lucide-react-native';
import { COUNTRIES } from '../../constants/countries';
import { useAppTheme, Radius, Shadows, Spacing } from '../../constants/theme';
import type { ThemeColors } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { uploadProfilePhoto } from '../../lib/uploadAvatar';
import { useAuthStore } from '../../stores/authStore';

// ── Static data ────────────────────────────────────────────────────────────

const MAX_PHOTOS = 4;

const PERSONA_TAGS = [
  'Foodie',
  'Night Owl',
  'Early Bird',
  'History Nerd',
  'Party Starter',
  'Solo Explorer',
  'Photographer',
  'Gym Rat',
  'Bookworm',
  'Live Music',
  'Coffee Snob',
  'Surfer',
];

const TRAVEL_STYLES = [
  'Digital Nomad',
  'Backpacker',
  'Luxury Traveler',
  'Foodie',
  'Adventure Seeker',
  'Culture Buff',
  'Beach Bum',
  'City Explorer',
  'Budget Traveler',
  'Eco Traveler',
];

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Portuguese',
  'Mandarin', 'Japanese', 'Korean', 'Italian', 'Arabic',
  'Hindi', 'Russian', 'Dutch', 'Turkish', 'Thai', 'Vietnamese',
];

function toggle(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
}

// ── Photo item types ───────────────────────────────────────────────────────

interface PhotoItem {
  uri: string;
  isLocal: boolean; // true = picked from device, needs upload
}

// ── Styles ─────────────────────────────────────────────────────────────────

const THUMB_SIZE = 100;

const createLocalStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header (Glassmorphism) ───────────────────────────────────
  headerBlur: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
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
    alignItems: 'flex-end',
  },
  saveBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },

  // ── Scroll ──────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 28,
  },

  // ── Photo Gallery ─────────────────────────────────────────────
  galleryRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  thumbContainer: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: Radius.md,
    overflow: 'visible',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: Radius.md,
    backgroundColor: colors.surface,
  },
  deleteBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  addPhotoBtn: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  uploadingText: {
    fontSize: 13,
    color: colors.textTertiary,
  },

  // ── Field wrapper ────────────────────────────────────────────
  field: {
    gap: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fieldHint: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: -4,
  },

  // ── Text inputs ──────────────────────────────────────────────
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
  },
  inputMultiline: {
    height: 104,
    paddingTop: 14,
  },
  charCount: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'right',
    marginTop: -4,
  },

  // ── Chips (travel style / languages) ────────────────────────
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
  },

  // ── Persona chips (outlined accent style) ───────────────────
  personaChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  personaChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  personaChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  personaChipTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },

  // ── Country chips ────────────────────────────────────────────
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  countryFlag: {
    fontSize: 15,
  },
  countryCode: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },

  // ── Error ────────────────────────────────────────────────────
  errorText: {
    fontSize: 14,
    color: colors.errorLight,
    textAlign: 'center',
  },
});

// ── Component ──────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const { profile, setProfile, user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useAppTheme();
  const styles = useMemo(() => createLocalStyles(colors), [colors]);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [igHandle, setIgHandle] = useState(profile?.instagram_handle ?? '');
  const [personaTags, setPersonaTags] = useState<string[]>(profile?.persona_tags ?? []);
  const [travelStyles, setTravelStyles] = useState<string[]>(profile?.travel_styles ?? []);
  const [languages, setLanguages] = useState<string[]>(profile?.languages ?? []);
  const [visitedCountries, setVisitedCountries] = useState<string[]>(profile?.visited_countries ?? []);

  // Photos — seed from existing profile photo_urls
  const [photos, setPhotos] = useState<PhotoItem[]>(
    () => (profile?.photo_urls ?? []).map(uri => ({ uri, isLocal: false })),
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ── Photo picker ─────────────────────────────────────────────────────────

  const pickPhotos = async () => {
    if (photos.length >= MAX_PHOTOS) return;

    // Single-select with native 1:1 crop editor — each photo gets individual
    // attention. allowsEditing only works with allowsMultipleSelection=false.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    setPhotos(prev => [...prev, { uri: asset.uri, isLocal: true }]);
  };

  const removePhoto = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!profile || !user) return;

    if (!displayName.trim()) {
      setError('Display name cannot be empty.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSubmitting(true);
    setError(null);

    try {
      // Upload any new local photos
      const finalUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        if (photo.isLocal) {
          setUploadingPhoto(true);
          const url = await uploadProfilePhoto(photo.uri, user.id, i);
          finalUrls.push(url);
        } else {
          finalUrls.push(photo.uri);
        }
      }
      setUploadingPhoto(false);

      const { data, error: dbError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          instagram_handle: igHandle.trim().replace(/^@/, '') || null,
          persona_tags: personaTags,
          travel_styles: travelStyles,
          languages,
          visited_countries: visitedCountries,
          photo_urls: finalUrls,
        })
        .eq('id', profile.id)
        .select()
        .single();

      if (dbError) {
        setError(dbError.message);
        setIsSubmitting(false);
        return;
      }

      // Haptic success feedback — no alert
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setProfile(data);
      router.back();
    } catch (err: any) {
      setError(err?.message ?? "Couldn't save that. Try again?");
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header (Glassmorphism) ── */}
      <BlurView
        intensity={80}
        tint={scheme === 'light' ? 'systemMaterialLight' : 'systemMaterialDark'}
        style={[styles.headerBlur, { paddingTop: 10 }]}
      >
        <View style={styles.headerInner}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ChevronLeft size={20} color={colors.textPrimary} strokeWidth={2.5} />
            <Text style={styles.backLabel}>Profile</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Edit Profile</Text>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Photo Gallery Editor ── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Photos</Text>
          <Text style={styles.fieldHint}>Pick your best angles</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryRow}
          >
            {photos.map((photo, index) => (
              <View key={`${photo.uri}-${index}`} style={styles.thumbContainer}>
                <Image
                  source={{ uri: photo.uri }}
                  style={styles.thumb}
                  contentFit="cover"
                />
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => removePhoto(index)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={12} color={colors.white} strokeWidth={3} />
                </TouchableOpacity>
              </View>
            ))}

            {photos.length < MAX_PHOTOS && (
              <TouchableOpacity
                style={styles.addPhotoBtn}
                onPress={pickPhotos}
                activeOpacity={0.7}
              >
                <Plus size={24} color={colors.textTertiary} strokeWidth={2} />
                <Text style={styles.addPhotoText}>Add</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {uploadingPhoto && (
            <View style={styles.uploadingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.uploadingText}>Compressing & uploading...</Text>
            </View>
          )}
        </View>

        {/* ── Display Name ── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={colors.textTertiary}
            maxLength={50}
            returnKeyType="done"
          />
        </View>

        {/* ── Bio ── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Bio</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell travelers about yourself..."
            placeholderTextColor={colors.textTertiary}
            maxLength={300}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{bio.length} / 300</Text>
        </View>

        {/* ── Instagram ── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Instagram Handle</Text>
          <TextInput
            style={styles.input}
            value={igHandle}
            onChangeText={setIgHandle}
            placeholder="@yourhandle"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
        </View>

        {/* ── Persona Tags ── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Persona</Text>
          <Text style={styles.fieldHint}>What's your vibe?</Text>
          <View style={styles.chipGrid}>
            {PERSONA_TAGS.map(tag => {
              const active = personaTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.personaChip, active && styles.personaChipActive]}
                  onPress={() => setPersonaTags(pt => toggle(pt, tag))}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.personaChipText, active && styles.personaChipTextActive]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Travel Style ── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Travel Style</Text>
          <Text style={styles.fieldHint}>Pick all that apply</Text>
          <View style={styles.chipGrid}>
            {TRAVEL_STYLES.map(style => {
              const active = travelStyles.includes(style);
              return (
                <TouchableOpacity
                  key={style}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setTravelStyles(ts => toggle(ts, style))}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{style}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Languages ── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Languages</Text>
          <Text style={styles.fieldHint}>Languages you speak</Text>
          <View style={styles.chipGrid}>
            {LANGUAGES.map(lang => {
              const active = languages.includes(lang);
              return (
                <TouchableOpacity
                  key={lang}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setLanguages(ls => toggle(ls, lang))}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{lang}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Countries Visited ── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Countries Visited</Text>
          <Text style={styles.fieldHint}>Tap to mark countries you've been to</Text>
          <View style={styles.chipGrid}>
            {COUNTRIES.map(c => {
              const active = visitedCountries.includes(c.code);
              return (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.countryChip, active && styles.chipActive]}
                  onPress={() => setVisitedCountries(vc => toggle(vc, c.code))}
                  activeOpacity={0.75}
                >
                  <Text style={styles.countryFlag}>{c.flag}</Text>
                  <Text style={[styles.countryCode, active && styles.chipTextActive]}>{c.code}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Error ── */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
