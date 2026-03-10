// Required install (if not already done):
// npx expo install @react-native-community/datetimepicker

import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
} from 'react-native-maps';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useLocationStore } from '../../stores/locationStore';
import { useMapStore } from '../../stores/mapStore';
import { formatExpiry } from '../../lib/eventFormatters';
import { createStyles } from '../../styles/createEventStyles';
import { useAppTheme } from '../../constants/theme';
import type { Event, EventCategory } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: EventCategory; label: string; emoji: string }[] = [
  { value: 'beer', label: 'Beer/Bar', emoji: '🍺' },
  { value: 'food', label: 'Food', emoji: '🍜' },
  { value: 'sightseeing', label: 'Sightseeing', emoji: '🏛️' },
  { value: 'adventure', label: 'Adventure', emoji: '🧗' },
  { value: 'culture', label: 'Culture', emoji: '🎭' },
  { value: 'other', label: 'Other', emoji: '📍' },
];

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  title: z
    .string()
    .min(10, 'Title must be at least 10 characters')
    .max(60, 'Title must be 60 characters or fewer')
    .trim(),
  category: z.enum([
    'beer',
    'food',
    'sightseeing',
    'adventure',
    'culture',
    'other',
  ]),
  description: z
    .string()
    .max(300, 'Description must be 300 characters or fewer')
    .optional()
    .default(''),
  verified_only: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, profile } = useAuthStore();
  const { coordinates, city } = useLocationStore();
  const { addEvent } = useMapStore();

  const isVerified = profile?.verification_status === 'verified';

  // ── Pin location (tap-to-place) ───────────────────────────────────────────
  const [pinCoords, setPinCoords] = useState<{ latitude: number; longitude: number }>(
    () => coordinates ?? { latitude: 0, longitude: 0 },
  );
  const [locationName, setLocationName] = useState('');

  // ── Expiry datetime state ─────────────────────────────────────────────────
  // Default: 2 hours from now
  const [expiresAt, setExpiresAt] = useState<Date>(
    () => new Date(Date.now() + 2 * 60 * 60 * 1000),
  );
  // Android needs two-step: open 'date' dialog, then 'time' dialog
  // iOS uses inline 'datetime' spinner; 'none' means picker is hidden
  const [pickerMode, setPickerMode] = useState<'none' | 'date' | 'time' | 'datetime'>('none');

  const handlePickerChange = (_event: unknown, selected?: Date) => {
    if (!selected) {
      // User dismissed (Android back button)
      setPickerMode('none');
      return;
    }
    if (Platform.OS === 'android') {
      if (pickerMode === 'date') {
        // Got the date part — carry over existing time, then show time dialog
        const next = new Date(expiresAt);
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
        setExpiresAt(next);
        setPickerMode('time');
      } else {
        // Got the time part — merge into the stored date
        const next = new Date(expiresAt);
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
        setExpiresAt(next);
        setPickerMode('none');
      }
    } else {
      // iOS: inline spinner — just update directly
      setExpiresAt(selected);
    }
  };

  // ── Toast ────────────────────────────────────────────────────────────────
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  // ── Form ─────────────────────────────────────────────────────────────────
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      verified_only: false,
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleValue = watch('title') ?? '';
  const descValue = watch('description') ?? '';

  // ── Submit ───────────────────────────────────────────────────────────────
  const onSubmit = async (values: FormValues) => {
    if (!user || !coordinates || isSubmitting) return;

    // Guard: expiry must be at least 1 hour from now
    const minExpiry = Date.now() + 60 * 60 * 1000;
    if (expiresAt.getTime() < minExpiry) {
      Alert.alert(
        'Invalid End Time',
        'Your event must end at least 1 hour from now. Please pick a later time.',
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Session Error', 'Your session has expired. Please sign in again.');
        return;
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-event`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            title: values.title,
            category: values.category,
            description: values.description || null,
            expires_at: expiresAt.toISOString(),
            latitude: pinCoords.latitude,
            longitude: pinCoords.longitude,
            location_name: locationName.trim() || null,
            city: city ?? null,
            verified_only: values.verified_only,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) throw new Error(`SERVER SAID: ${data?.error ?? JSON.stringify(data)}`);

      // Free user event limit reached
      if (data?.code === 'LIMIT_REACHED') {
        Alert.alert(
          'Event Limit Reached',
          'Free users can have 1 active event at a time.\n\nGet Verified for €4.99 to create unlimited events.',
          [{ text: 'OK' }],
        );
        return;
      }

      if (!data?.event?.id) throw new Error('create-event returned no event id');

      // Optimistic UI — pin appears immediately on the map
      const optimisticEvent: Event = {
        id: data.event.id,
        host_id: user.id,
        title: values.title,
        description: values.description || null,
        category: values.category as EventCategory,
        status: 'active',
        verified_only: values.verified_only,
        participant_count: 1,
        expires_at: expiresAt.toISOString(),
        maps_taps: 0,
        arrivals: 0,
        post_event_messages: 0,
        created_at: new Date().toISOString(),
        latitude: pinCoords.latitude,
        longitude: pinCoords.longitude,
      };
      addEvent(optimisticEvent);

      showToast('Your event is live! 🎉');
      setTimeout(() => router.back(), 600);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[CreateEvent] submit failed:', message);
      Alert.alert('The Real Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPublishDisabled = !isValid || isSubmitting || !coordinates;

  // Picker constraints: min 1 h from now, max 26 h from now
  const pickerMin = new Date(Date.now() + 60 * 60 * 1000);
  const pickerMax = new Date(Date.now() + 26 * 60 * 60 * 1000);

  // The paddingTop for the header uses the safe-area top inset so it respects
  // camera cutouts and notches on both Android and iOS.
  const headerPaddingTop = insets.top + 12;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
          <Text style={styles.headerTitle}>New Event</Text>
          <Pressable
            onPress={() => router.back()}
            disabled={isSubmitting}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[styles.closeBtn, { top: headerPaddingTop }]}
          >
            <X color="#94A3B8" size={22} strokeWidth={2} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Title ── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Title</Text>
            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.title && styles.inputError]}
                  placeholder="e.g. Rooftop beers at Khao San"
                  placeholderTextColor="#475569"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  maxLength={60}
                  autoFocus
                  returnKeyType="done"
                />
              )}
            />
            <View style={styles.inputMeta}>
              {errors.title ? (
                <Text style={styles.errorText}>{errors.title.message}</Text>
              ) : (
                <View />
              )}
              <Text style={styles.charCount}>{titleValue.length}/60</Text>
            </View>
          </View>

          {/* ── Category ── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Category</Text>
            <Controller
              control={control}
              name="category"
              render={({ field: { onChange, value } }) => (
                <View style={styles.chipGrid}>
                  {CATEGORIES.map((cat) => {
                    const selected = value === cat.value;
                    return (
                      <Pressable
                        key={cat.value}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => onChange(cat.value)}
                      >
                        <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                        <Text
                          style={[
                            styles.chipLabel,
                            selected && styles.chipLabelSelected,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            />
            {errors.category && (
              <Text style={styles.errorText}>Please select a category</Text>
            )}
          </View>

          {/* ── Description (optional) ── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Description{' '}
              <Text style={styles.labelOptional}>(optional)</Text>
            </Text>
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[
                    styles.input,
                    styles.textArea,
                    errors.description && styles.inputError,
                  ]}
                  placeholder="What's the plan? Where should people head?"
                  placeholderTextColor="#475569"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  maxLength={300}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              )}
            />
            <Text style={[styles.charCount, styles.charCountRight]}>
              {descValue.length}/300
            </Text>
            {errors.description && (
              <Text style={styles.errorText}>{errors.description.message}</Text>
            )}
          </View>

          {/* ── Location name ── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Location Name / Details{' '}
              <Text style={styles.labelOptional}>(optional)</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={locationName}
              onChangeText={setLocationName}
              placeholder="e.g. Starbucks near the park"
              placeholderTextColor="#475569"
              maxLength={100}
              returnKeyType="done"
            />
          </View>

          {/* ── Location picker ── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Event Location</Text>
            <Text style={styles.locationHint}>Tap anywhere on the map to set the exact location.</Text>
            {coordinates ? (
              <View style={styles.mapPickerContainer}>
                <MapView
                  style={styles.mapPicker}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                  initialRegion={{
                    latitude: pinCoords.latitude,
                    longitude: pinCoords.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  onPress={(e) => setPinCoords(e.nativeEvent.coordinate)}
                >
                  <Marker coordinate={pinCoords} />
                </MapView>
              </View>
            ) : (
              <View style={styles.mapPlaceholder}>
                <Text style={styles.mapPlaceholderText}>
                  Waiting for location…{'\n'}Enable location access to set your event pin.
                </Text>
              </View>
            )}
          </View>

          {/* ── Expiry — datetime picker ── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Event ends at</Text>

            {/* Tap to open picker */}
            <Pressable
              style={styles.dateRow}
              onPress={() =>
                setPickerMode(Platform.OS === 'ios' ? 'datetime' : 'date')
              }
            >
              <Text style={styles.dateRowIcon}>🕐</Text>
              <Text style={styles.dateRowText}>{formatExpiry(expiresAt)}</Text>
              <Text style={styles.dateRowChevron}>›</Text>
            </Pressable>

            {/* Android: dialog appears when pickerMode !== 'none'
                iOS: inline spinner rendered below the button */}
            {pickerMode !== 'none' && (
              <>
                <DateTimePicker
                  value={expiresAt}
                  mode={
                    pickerMode === 'datetime'
                      ? 'datetime'
                      : pickerMode === 'date'
                      ? 'date'
                      : 'time'
                  }
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={pickerMin}
                  maximumDate={pickerMax}
                  onChange={handlePickerChange}
                  // iOS only — makes the spinner text readable on dark backgrounds
                  {...(Platform.OS === 'ios' ? { textColor: '#F8FAFC' } : {})}
                />
                {Platform.OS === 'ios' && (
                  <Pressable
                    style={styles.datePickerDoneBtn}
                    onPress={() => setPickerMode('none')}
                  >
                    <Text style={styles.datePickerDoneBtnText}>Confirm</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          {/* ── Verified-only toggle ── */}
          <Controller
            control={control}
            name="verified_only"
            render={({ field: { onChange, value } }) => (
              <View
                style={[
                  styles.toggleRow,
                  !isVerified && styles.toggleRowDisabled,
                ]}
              >
                <View style={styles.toggleTextGroup}>
                  <Text style={styles.toggleTitle}>
                    Verified travelers only
                  </Text>
                  <Text style={styles.toggleSubtitle}>
                    {isVerified
                      ? 'Only verified users can join your event'
                      : 'Get verified to enable this option'}
                  </Text>
                </View>
                <Switch
                  value={isVerified ? value : false}
                  onValueChange={isVerified ? onChange : undefined}
                  disabled={!isVerified}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.white}
                  ios_backgroundColor={colors.border}
                />
              </View>
            )}
          />

          {/* ── Publish button ── */}
          <Pressable
            style={[styles.publishBtn, isPublishDisabled && styles.btnDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isPublishDisabled}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.publishBtnText}>Publish Event</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Toast ── */}
      <Animated.View
        style={[styles.toast, { opacity: toastOpacity }]}
        pointerEvents="none"
      >
        <Text style={styles.toastText}>{toastMessage}</Text>
      </Animated.View>
    </SafeAreaView>
  );
}
