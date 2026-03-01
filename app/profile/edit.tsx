import { router } from 'expo-router';
import { useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { COUNTRIES } from '../../constants/countries';
import { Colors } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

// ── Static data ────────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const { profile, setProfile } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [igHandle, setIgHandle] = useState(profile?.instagram_handle ?? '');
  const [travelStyles, setTravelStyles] = useState<string[]>(profile?.travel_styles ?? []);
  const [languages, setLanguages] = useState<string[]>(profile?.languages ?? []);
  const [visitedCountries, setVisitedCountries] = useState<string[]>(profile?.visited_countries ?? []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!profile) return;

    if (!displayName.trim()) {
      setError('Display name cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const { data, error: dbError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        instagram_handle: igHandle.trim().replace(/^@/, '') || null,
        travel_styles: travelStyles,
        languages,
        visited_countries: visitedCountries,
      })
      .eq('id', profile.id)
      .select()
      .single();

    if (dbError) {
      setError(dbError.message);
      setIsSubmitting(false);
      return;
    }

    setProfile(data);
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.5} />
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
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Display Name ── */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={Colors.textTertiary}
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
            placeholderTextColor={Colors.textTertiary}
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
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
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
    alignItems: 'flex-end',
  },
  saveBtn: {
    backgroundColor: Colors.accent,
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
    color: Colors.white,
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

  // ── Field wrapper ────────────────────────────────────────────
  field: {
    gap: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fieldHint: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: -4,
  },

  // ── Text inputs ──────────────────────────────────────────────
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  inputMultiline: {
    height: 104,
    paddingTop: 14,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textTertiary,
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
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.white,
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
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  countryFlag: {
    fontSize: 15,
  },
  countryCode: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },

  // ── Error ────────────────────────────────────────────────────
  errorText: {
    fontSize: 14,
    color: Colors.errorLight,
    textAlign: 'center',
  },
});
