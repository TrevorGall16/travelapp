// app/event/edit-location.tsx — Drag-to-reposition event pin (host only)
// Navigation: router.push('/event/edit-location?eventId=xxx&lat=xx&lon=xx')

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
} from 'react-native-maps';

import { supabase } from '../../lib/supabase';
import { useMapStore } from '../../stores/mapStore';
import { useAppTheme } from '../../constants/theme';

export default function EditLocationScreen() {
  const { eventId, lat, lon } = useLocalSearchParams<{
    eventId: string;
    lat: string;
    lon: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { updateEvent, events } = useMapStore();

  const initialLat = parseFloat(lat ?? '0');
  const initialLon = parseFloat(lon ?? '0');

  const [pinCoords, setPinCoords] = useState({
    latitude: initialLat,
    longitude: initialLon,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!eventId || isSaving) return;
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Session Expired', 'Please sign in again.');
        return;
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/update-event-location`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            event_id: eventId,
            latitude: pinCoords.latitude,
            longitude: pinCoords.longitude,
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Update failed');

      // Sync local mapStore so the pin moves immediately without a full refetch
      const existing = events.find(e => e.id === eventId);
      if (existing) {
        updateEvent({
          ...existing,
          latitude: pinCoords.latitude,
          longitude: pinCoords.longitude,
        });
      }

      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Error', `Could not update location: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
        </Pressable>
        <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '600' }}>
          Move Pin
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }}>
              Save
            </Text>
          )}
        </Pressable>
      </View>

      {/* Hint */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: colors.surface,
        }}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
          Drag the pin to your exact meetup area
        </Text>
      </View>

      {/* Map */}
      <MapView
        style={{ flex: 1 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={{
          latitude: initialLat,
          longitude: initialLon,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Marker
          coordinate={pinCoords}
          draggable
          onDragEnd={e => setPinCoords(e.nativeEvent.coordinate)}
        />
      </MapView>

      {/* Bottom coord readout */}
      <View
        style={{
          paddingBottom: insets.bottom + 16,
          paddingTop: 12,
          paddingHorizontal: 16,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.textTertiary, fontSize: 12, fontFamily: 'monospace' }}>
          {pinCoords.latitude.toFixed(6)}, {pinCoords.longitude.toFixed(6)}
        </Text>
      </View>
    </View>
  );
}
