// Required installs (if not yet installed):
// npx expo install expo-image expo-image-picker expo-file-system
// npm install react-hook-form @hookform/resolvers zod base64-arraybuffer

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CountryPicker } from '../../components/auth/CountryPicker';
import { COUNTRIES } from '../../constants/countries';
import { Colors } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { uploadAvatar } from '../../lib/uploadAvatar';
import { useAuthStore } from '../../stores/authStore';
import { styles } from '../../styles/setupStyles';
import type { Country } from '../../types';

// ── Zod schemas ──────────────────────────────────────────────────────────────

const step1Schema = z.object({
  display_name: z
    .string()
    .min(1, 'Name is required')
    .max(20, 'Name must be 20 characters or fewer')
    .trim(),
  country_code: z.string().length(2, 'Please select your home country'),
  avatar_url: z.string().min(1, 'Profile photo is required'),
});

const step2Schema = z.object({
  bio: z
    .string()
    .max(160, 'Bio must be 160 characters or fewer')
    .optional()
    .default(''),
  instagram_handle: z
    .string()
    .max(30, 'Handle is too long')
    .regex(/^[a-zA-Z0-9._]*$/, 'Invalid Instagram handle')
    .optional()
    .default(''),
});

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;

// ── Main Component ────────────────────────────────────────────────────────────

export default function SetupScreen() {
  const { user, setProfile } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCountryPickerVisible, setIsCountryPickerVisible] = useState(false);

  // ── Step 1 form ──────────────────────────────────────────────────────────
  const {
    control: control1,
    handleSubmit: handleSubmit1,
    setValue: setValue1,
    watch: watch1,
    formState: { errors: errors1, isValid: isValid1 },
  } = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    mode: 'onChange',
    defaultValues: { display_name: '', country_code: '', avatar_url: '' },
  });

  // ── Step 2 form ──────────────────────────────────────────────────────────
  const {
    control: control2,
    handleSubmit: handleSubmit2,
    watch: watch2,
  } = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    mode: 'onChange',
    defaultValues: { bio: '', instagram_handle: '' },
  });

  const selectedCountryCode = watch1('country_code');
  const bioValue = watch2('bio') ?? '';

  const selectedCountry: Country | undefined = COUNTRIES.find(
    (c) => c.code === selectedCountryCode,
  );

  // ── Image picker ─────────────────────────────────────────────────────────
  const handlePickImage = async () => {
    if (isPickingImage || isSubmitting) return;
    setIsPickingImage(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow photo library access to add a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        // Pass the string literal array — the safest form per SDK 52+ docs.
        // MediaTypeOptions is deprecated; MediaType enum keys are lowercase
        // ('images'), not 'Images' or 'PHOTO', so the array avoids that trap.
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        // quality < 1.0 forces Expo to transcode HEIC → JPEG before handing
        // back the URI. Without this, iOS camera roll photos stay as .heic
        // and Supabase Storage rejects them if the bucket only accepts JPEG/PNG.
        quality: 0.7,
      });

      if (!result.canceled && result.assets.length > 0) {
        const uri = result.assets[0]!.uri;
        setLocalAvatarUri(uri);
        // Store local URI in form — will be uploaded on final submit
        setValue1('avatar_url', uri, { shouldValidate: true });
      }
    } catch (err) {
      console.error('[Setup] - SetupScreen - Image pick failed:', err);
      Alert.alert('Error', 'Could not open photo library. Please try again.');
    } finally {
      setIsPickingImage(false);
    }
  };

  // ── Step 1 → Step 2 ──────────────────────────────────────────────────────
  const onStep1Next = (data: Step1Values) => {
    setStep1Data(data);
    setStep(2);
  };

  // ── Final submit ─────────────────────────────────────────────────────────
  const onStep2Done = async (step2: Step2Values) => {
    if (!user || !step1Data || isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Upload avatar to Supabase Storage
      const avatarPublicUrl = await uploadAvatar(step1Data.avatar_url, user.id);

      // Strip leading @ from Instagram handle
      const igHandle = step2.instagram_handle?.replace(/^@/, '') || null;

      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update({
          display_name: step1Data.display_name,
          country_code: step1Data.country_code,
          avatar_url: avatarPublicUrl,
          bio: step2.bio || null,
          instagram_handle: igHandle,
          // Explicit flag — the navigation guard uses this as the sole signal
          // that onboarding is complete. String checks on display_name/country_code
          // are unreliable because the DB trigger pre-fills them with placeholders.
          setup_completed: true,
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Update the store — root layout guard navigates to /(tabs)/ automatically
      setProfile(updatedProfile);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Setup] - SetupScreen - Profile save failed:', message);
      Alert.alert('Save Failed', 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Step 2 "Done" skips optional fields ──────────────────────────────────
  const handleDone = handleSubmit2(onStep2Done);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          {step === 2 && (
            <TouchableOpacity
              onPress={() => setStep(1)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              disabled={isSubmitting}
            >
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          )}
          <View style={styles.headerCenter}>
            <Text style={styles.stepIndicator}>Step {step} of 2</Text>
            <Text style={styles.title}>
              {step === 1 ? 'Create Your Profile' : 'Add Some Details'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 1
                ? 'This is how other travelers will find you.'
                : 'Optional — you can always update these later.'}
            </Text>
          </View>
        </View>

        {/* ─────────────────── STEP 1 ─────────────────── */}
        {step === 1 && (
          <View style={styles.form}>
            {/* Avatar picker */}
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handlePickImage}
              disabled={isPickingImage || isSubmitting}
              activeOpacity={0.8}
            >
              {localAvatarUri ? (
                <Image
                  source={{ uri: localAvatarUri }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  {isPickingImage ? (
                    <ActivityIndicator color={Colors.accent} />
                  ) : (
                    <>
                      <Text style={styles.avatarPlaceholderIcon}>📷</Text>
                      <Text style={styles.avatarPlaceholderText}>Add Photo</Text>
                      <Text style={styles.avatarHint}>Face required</Text>
                    </>
                  )}
                </View>
              )}
              {localAvatarUri && (
                <View style={styles.avatarEditBadge}>
                  <Text style={styles.avatarEditBadgeText}>Edit</Text>
                </View>
              )}
            </TouchableOpacity>
            {errors1.avatar_url && (
              <Text style={styles.errorText}>{errors1.avatar_url.message}</Text>
            )}

            {/* Display Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>First name</Text>
              <Controller
                control={control1}
                name="display_name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, errors1.display_name && styles.inputError]}
                    placeholder="e.g. Alex"
                    placeholderTextColor={Colors.textTertiary}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    maxLength={20}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                )}
              />
              <View style={styles.inputMeta}>
                {errors1.display_name ? (
                  <Text style={styles.errorText}>{errors1.display_name.message}</Text>
                ) : (
                  <View />
                )}
                <Text style={styles.charCount}>{watch1('display_name').length}/20</Text>
              </View>
            </View>

            {/* Country Picker */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Home country</Text>
              <TouchableOpacity
                style={[styles.input, styles.selectRow, errors1.country_code && styles.inputError]}
                onPress={() => setIsCountryPickerVisible(true)}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {selectedCountry ? (
                  <>
                    <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                    <Text style={styles.countryName}>{selectedCountry.name}</Text>
                  </>
                ) : (
                  <Text style={styles.selectPlaceholder}>Select your country</Text>
                )}
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
              {errors1.country_code && (
                <Text style={styles.errorText}>{errors1.country_code.message}</Text>
              )}
            </View>

            <CountryPicker
              visible={isCountryPickerVisible}
              selectedCode={selectedCountryCode}
              onSelect={(country) => {
                setValue1('country_code', country.code, { shouldValidate: true });
              }}
              onClose={() => setIsCountryPickerVisible(false)}
            />

            <TouchableOpacity
              style={[styles.primaryButton, !isValid1 && styles.buttonDisabled]}
              onPress={handleSubmit1(onStep1Next)}
              disabled={!isValid1 || isSubmitting}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─────────────────── STEP 2 ─────────────────── */}
        {step === 2 && (
          <View style={styles.form}>
            {/* Bio */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Short bio</Text>
              <Controller
                control={control2}
                name="bio"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Tell travelers a bit about yourself..."
                    placeholderTextColor={Colors.textTertiary}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    maxLength={160}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                )}
              />
              <Text style={styles.charCountRight}>{bioValue.length}/160</Text>
            </View>

            {/* Instagram Handle */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Instagram handle</Text>
              <Controller
                control={control2}
                name="instagram_handle"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={styles.igRow}>
                    <View style={styles.igPrefix}>
                      <Text style={styles.igPrefixText}>@</Text>
                    </View>
                    <TextInput
                      style={[styles.input, styles.igInput]}
                      placeholder="yourusername"
                      placeholderTextColor={Colors.textTertiary}
                      // Auto-strip the @ if the user types it
                      value={value?.replace(/^@/, '')}
                      onChangeText={(text) => onChange(text.replace(/^@/, ''))}
                      onBlur={onBlur}
                      maxLength={30}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="twitter"
                    />
                  </View>
                )}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleDone}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Done ✓</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleDone}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
