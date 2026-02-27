import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';

import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useLocationStore } from '../../stores/locationStore';
import { useMapStore } from '../../stores/mapStore';
import type { Event, EventCategory } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ELECTRIC_BLUE = '#3B82F6';

const CATEGORIES: { value: EventCategory; label: string; emoji: string }[] = [
  { value: 'beer', label: 'Beer/Bar', emoji: '🍺' },
  { value: 'food', label: 'Food', emoji: '🍜' },
  { value: 'sightseeing', label: 'Sightseeing', emoji: '🏛️' },
  { value: 'adventure', label: 'Adventure', emoji: '🧗' },
  { value: 'culture', label: 'Culture', emoji: '🎭' },
  { value: 'other', label: 'Other', emoji: '📍' },
];

type ExpiryOption = '2h' | '4h' | '8h' | 'tomorrow_9am';

const EXPIRY_OPTIONS: { value: ExpiryOption; label: string }[] = [
  { value: '2h', label: '2 hours' },
  { value: '4h', label: '4 hours' },
  { value: '8h', label: '8 hours' },
  { value: 'tomorrow_9am', label: 'Tomorrow 9 AM' },
];

function computeExpiresAt(option: ExpiryOption): Date {
  const now = new Date();
  switch (option) {
    case '2h':
      return new Date(now.getTime() + 2 * 60 * 60 * 1000);
    case '4h':
      return new Date(now.getTime() + 4 * 60 * 60 * 1000);
    case '8h':
      return new Date(now.getTime() + 8 * 60 * 60 * 1000);
    case 'tomorrow_9am': {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow;
    }
  }
}

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
  expiry: z.enum(['2h', '4h', '8h', 'tomorrow_9am']),
  verified_only: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateEventScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { coordinates, city } = useLocationStore();
  const { addEvent } = useMapStore();

  const isVerified = profile?.verification_status === 'verified';

  // ── Toast ────────────────────────────────────────────────────────────────
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(2200),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
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
      // category has no default — user must explicitly select one
      description: '',
      expiry: '2h',
      verified_only: false,
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleValue = watch('title') ?? '';
  const descValue = watch('description') ?? '';

  // ── Submit ───────────────────────────────────────────────────────────────
  const onSubmit = async (values: FormValues) => {
    if (!user || !coordinates || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const expiresAt = computeExpiresAt(values.expiry as ExpiryOption);

      const { data, error } = await supabase.functions.invoke('create-event', {
        body: {
          title: values.title,
          category: values.category,
          description: values.description || null,
          expires_at: expiresAt.toISOString(),
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          city: city ?? null,
          verified_only: values.verified_only,
        },
      });

      if (error) throw error;

      // Free user event limit reached — server returns this code
      if (data?.code === 'LIMIT_REACHED') {
        // TODO: Replace with paywall bottom sheet (Flow 7) in a future phase
        Alert.alert(
          'Event Limit Reached',
          'Free users can have 1 active event at a time.\n\nGet Verified for €4.99 to create unlimited events.',
          [{ text: 'OK' }],
        );
        return;
      }

      if (!data?.event?.id) throw new Error('create-event returned no event id');

      // Optimistic UI — pin appears immediately on the map without waiting for Realtime
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
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      };
      addEvent(optimisticEvent);

      showToast('Your event is live! 🎉');

      // Short delay so the user sees the toast before the modal closes
      setTimeout(() => router.back(), 600);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[CreateEvent] - CreateEventScreen - submit failed:', message);
      Alert.alert('Error', 'Could not create event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPublishDisabled = !isValid || isSubmitting || !coordinates;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Event</Text>
          <Pressable
            onPress={() => router.back()}
            disabled={isSubmitting}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.closeBtn}
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

          {/* ── Expiry ── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Expires in</Text>
            <Controller
              control={control}
              name="expiry"
              render={({ field: { onChange, value } }) => (
                <View style={styles.expiryGrid}>
                  {EXPIRY_OPTIONS.map((opt) => {
                    const selected = value === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        style={[
                          styles.expiryOption,
                          selected && styles.expiryOptionSelected,
                        ]}
                        onPress={() => onChange(opt.value)}
                      >
                        <Text
                          style={[
                            styles.expiryLabel,
                            selected && styles.expiryLabelSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            />
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
                  trackColor={{ false: '#334155', true: ELECTRIC_BLUE }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#334155"
                />
              </View>
            )}
          />

          {/* ── Location indicator ── */}
          <View style={styles.locationRow}>
            <Text style={styles.locationPin}>📍</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {coordinates
                ? city
                  ? `${city} — current location`
                  : 'Current location'
                : 'Waiting for location…'}
            </Text>
          </View>

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
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    top: Platform.OS === 'ios' ? 16 : 24,
    padding: 4,
  },

  // Scroll content
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 24,
  },

  // Field group
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelOptional: {
    fontWeight: '400',
    textTransform: 'none',
    color: '#475569',
  },

  // Inputs
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  textArea: {
    minHeight: 88,
    paddingTop: 14,
  },
  inputMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 12,
    color: '#475569',
  },
  charCountRight: {
    textAlign: 'right',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
  },

  // Category chips — 3 per row
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
    // ~3 per row on standard screens
    minWidth: '30%',
  },
  chipSelected: {
    backgroundColor: '#1D3E6E',
    borderColor: ELECTRIC_BLUE,
  },
  chipEmoji: {
    fontSize: 18,
  },
  chipLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  chipLabelSelected: {
    color: '#F8FAFC',
  },

  // Expiry options — 2x2 grid
  expiryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  expiryOption: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  expiryOptionSelected: {
    backgroundColor: '#1D3E6E',
    borderColor: ELECTRIC_BLUE,
  },
  expiryLabel: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  expiryLabelSelected: {
    color: '#F8FAFC',
    fontWeight: '600',
  },

  // Verified toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  toggleRowDisabled: {
    opacity: 0.5,
  },
  toggleTextGroup: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  toggleSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },

  // Location indicator
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  locationPin: {
    fontSize: 16,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#64748B',
  },

  // Publish button
  publishBtn: {
    backgroundColor: ELECTRIC_BLUE,
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: ELECTRIC_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  publishBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 48 : 32,
    alignSelf: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
    textAlign: 'center',
  },
});
