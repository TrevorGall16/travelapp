import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, {
  Marker,
  type Region,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
} from 'react-native-maps';
import * as Location from 'expo-location';
import Supercluster from 'supercluster';
import { useRouter } from 'expo-router';
import { Bell, Check, LocateFixed, Plus, SlidersHorizontal } from 'lucide-react-native';

import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useLocationStore } from '../../stores/locationStore';
import { useMapStore } from '../../stores/mapStore';
import EventCard from '../../components/map/EventCard';
import { Colors } from '../../constants/theme';
import type { DBEvent, Event, EventCategory } from '../../types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  haversineMeters,
  dbEventToEvent,
  eventsToGeoFeatures,
  type PinProperties,
  type ClusterOutput,
} from '../../lib/mapGeo';
import { styles } from '../../styles/mapScreenStyles';

// ─── Constants ────────────────────────────────────────────────────────────────

const FETCH_RADIUS_KM = 5;
const FETCH_RADIUS_METERS = FETCH_RADIUS_KM * 1_000; // kept for haversine guard
const REFETCH_THRESHOLD_METERS = 500;
const LOCATION_INTERVAL_MS = 30_000;
const LOCATION_DISTANCE_M = 100;

const FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Events', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'this_week' },
];

const CATEGORY_EMOJI: Record<EventCategory, string> = {
  beer: '🍺',
  food: '🍜',
  sightseeing: '🏛️',
  adventure: '🧗',
  culture: '🎭',
  other: '📍',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const { coordinates, city, setCoordinates, setPermissionStatus, setCity } =
    useLocationStore();
  const { events, setEvents, addEvent, updateEvent, removeEvent } =
    useMapStore();

  const [isLoading, setIsLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [clusters, setClusters] = useState<ClusterOutput[]>([]);
  const [region, setRegion] = useState<Region | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const mapRef = useRef<MapView>(null);
  const lastFetchRef = useRef<{ latitude: number; longitude: number } | null>(
    null,
  );
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Stable supercluster instance — recreated only when component mounts.
  const sc = useRef(
    new Supercluster<PinProperties>({ radius: 6000, maxZoom: 20 }),
  );

  // ── RPC fetch ──────────────────────────────────────────────────────────────

  const fetchEvents = useCallback(
    async (lat: number, lon: number) => {
      console.log('[Map Fetch] Payload:', { lat, lng: lon, radius_km: FETCH_RADIUS_KM });

      const { data, error } = await supabase.rpc('get_nearby_events', {
        lat,
        lng: lon,
        radius_km: FETCH_RADIUS_KM,
      });

      console.log('[Map Fetch] Result: rows =', Array.isArray(data) ? data.length : data,
        '| error =', error?.message ?? null,
        '| first row =', Array.isArray(data) && data.length > 0 ? JSON.stringify(data[0]) : 'none',
      );

      if (error) {
        console.error('[Map] get_nearby_events error:', error.message, error.details);
        return;
      }
      const now = new Date();
      const parsed: Event[] = ((data ?? []) as DBEvent[])
        .map(dbEventToEvent)
        .filter((e): e is Event => e !== null)
        .filter(e => e.status === 'active' && new Date(e.expires_at) > now);

      console.log('[Map Fetch] Parsed events:', parsed.length,
        '| skipped (bad coords):', (data?.length ?? 0) - parsed.length,
      );

      setEvents(parsed);
      lastFetchRef.current = { latitude: lat, longitude: lon };
    },
    [setEvents],
  );

  // ── Supercluster computation ───────────────────────────────────────────────

  const recomputeClusters = useCallback(
    (r: Region, evts: Event[]) => {
      const { latitude, longitude, latitudeDelta, longitudeDelta } = r;

      // Zero-guards: bail on degenerate region values
      if (
        !latitudeDelta ||
        !longitudeDelta ||
        latitudeDelta <= 0 ||
        longitudeDelta <= 0 ||
        !isFinite(latitude) ||
        !isFinite(longitude)
      ) {
        return;
      }

      const zoom = Math.max(0, Math.min(20, Math.round(Math.log2(360 / longitudeDelta))));
      const bbox: [number, number, number, number] = [
        longitude - longitudeDelta / 2,
        latitude - latitudeDelta / 2,
        longitude + longitudeDelta / 2,
        latitude + latitudeDelta / 2,
      ];

      sc.current.load(eventsToGeoFeatures(evts));

      try {
        const result = sc.current.getClusters(bbox, zoom) as ClusterOutput[];
        setClusters(result);
      } catch (err) {
        console.error('[Map] supercluster.getClusters error:', err);
      }
    },
    [],
  );

  // ── Realtime subscription ─────────────────────────────────────────────────

  const subscribeRealtime = useCallback(
    (userCoords: { latitude: number; longitude: number }) => {
      // Tear down any existing channel before creating a fresh one
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // NOTE: A `city` TEXT column should be added to the `events` table and
      // used here as `filter: 'city=eq.<cityName>'` to scope the subscription
      // server-side and prevent global data leaks. Until then we filter
      // client-side by radius after receiving each change.
      const channel = supabase
        .channel('events-map')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'events' },
          (payload) => {
            const row = payload.new as DBEvent;
            if (row.status !== 'active') return;
            const event = dbEventToEvent(row);
            if (!event) return;
            // Client-side radius guard
            const dist = haversineMeters(
              userCoords.latitude,
              userCoords.longitude,
              event.latitude,
              event.longitude,
            );
            if (dist <= FETCH_RADIUS_METERS) addEvent(event);
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'events' },
          (payload) => {
            const row = payload.new as DBEvent;
            if (row.status === 'expired') {
              removeEvent(row.id);
            } else {
              const event = dbEventToEvent(row);
              if (event) updateEvent(event);
            }
          },
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'events' },
          (payload) => {
            const old = payload.old as { id?: string };
            if (old.id) removeEvent(old.id);
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Map] Realtime subscribed');
          }
        });

      channelRef.current = channel;
    },
    [addEvent, updateEvent, removeEvent],
  );

  // ── Location init (runs once on mount) ────────────────────────────────────

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      // Guard: if setup isn't complete the root layout will redirect to setup.
      // Never request permissions in that window — it would interrupt the user.
      if (!profile?.setup_completed) {
        setIsLoading(false);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (isMounted) setPermissionStatus(status);

      if (status !== 'granted') {
        if (isMounted) {
          setPermissionDenied(true);
          setIsLoading(false);
        }
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!isMounted) return;

      const { latitude, longitude } = pos.coords;
      setCoordinates({ latitude, longitude });

      // Reverse-geocode to extract city name for Realtime scoping
      let detectedCity: string | null = null;
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        detectedCity =
          place?.city ?? place?.district ?? place?.subregion ?? null;
        if (isMounted) setCity(detectedCity);
      } catch (err) {
        console.warn('[Map] Reverse geocode failed:', err);
      }

      await fetchEvents(latitude, longitude);
      if (!isMounted) return;

      subscribeRealtime({ latitude, longitude });

      const initialRegion: Region = {
        latitude,
        longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      };
      setRegion(initialRegion);
      setIsLoading(false);

      // Continuous location watch: update every 30 s or 100 m
      const watch = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: LOCATION_INTERVAL_MS,
          distanceInterval: LOCATION_DISTANCE_M,
        },
        async (newPos) => {
          if (!isMounted) return;
          const { latitude: newLat, longitude: newLon } = newPos.coords;
          setCoordinates({ latitude: newLat, longitude: newLon });

          // Re-fetch + re-subscribe when user has moved > 500 m from last fetch
          const last = lastFetchRef.current;
          if (last) {
            const dist = haversineMeters(
              last.latitude,
              last.longitude,
              newLat,
              newLon,
            );
            if (dist > REFETCH_THRESHOLD_METERS) {
              await fetchEvents(newLat, newLon);
              if (isMounted) {
                subscribeRealtime({ latitude: newLat, longitude: newLon });
              }
            }
          }
        },
      );

      // Guard: if component unmounted while watchPositionAsync was resolving
      if (!isMounted) {
        watch.remove();
        return;
      }
      locationWatchRef.current = watch;
    };

    init();

    return () => {
      isMounted = false;
      locationWatchRef.current?.remove();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute clusters whenever the event list or visible region changes
  useEffect(() => {
    if (region) recomputeClusters(region, events);
  }, [events, region, recomputeClusters]);

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleRegionChangeComplete = useCallback(
    (newRegion: Region) => {
      setRegion(newRegion);
      recomputeClusters(newRegion, events);
    },
    [events, recomputeClusters],
  );

  const handleClusterPress = useCallback(
    (clusterId: number, coordinate: { latitude: number; longitude: number }) => {
      if (!mapRef.current) return;
      const leaves = sc.current.getLeaves(clusterId, Infinity);
      if (leaves.length === 0) return; // zero-guard

      const lats = leaves.map((f) => f.geometry.coordinates[1]);
      const lons = leaves.map((f) => f.geometry.coordinates[0]);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);

      mapRef.current.fitToCoordinates(
        [
          { latitude: minLat, longitude: minLon },
          { latitude: maxLat, longitude: maxLon },
        ],
        {
          edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
          animated: true,
        },
      );
    },
    [],
  );

  const handlePinPress = useCallback(
    (eventId: string) => {
      const found = events.find((e) => e.id === eventId) ?? null;
      setSelectedEvent(found);
    },
    [events],
  );

  const handleRecenter = useCallback(() => {
    if (!coordinates || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      },
      500,
    );
  }, [coordinates]);

  // ── Marker rendering ──────────────────────────────────────────────────────

  const renderedMarkers = useMemo(() => {
    return clusters
      .map((feature) => {
        const [lon, lat] = feature.geometry.coordinates;
        // Zero-guard: skip features with degenerate coordinates
        if (!isFinite(lat) || !isFinite(lon)) return null;
        const coordinate = { latitude: lat, longitude: lon };

        if ((feature.properties as { cluster?: boolean }).cluster) {
          const clusterProps = feature.properties as Supercluster.ClusterProperties;
          const { cluster_id: clusterId, point_count: count } = clusterProps;
          return (
            <Marker
              key={`cluster-${clusterId}`}
              coordinate={coordinate}
              onPress={() =>
                handleClusterPress(clusterId as number, coordinate)
              }
              tracksViewChanges={false}
            >
              <View style={styles.clusterMarker}>
                <Text style={styles.clusterCount}>{count}</Text>
              </View>
            </Marker>
          );
        }

        // Individual event pin
        const { eventId, category, hostVerified } =
          feature.properties as PinProperties;
        return (
          <Marker
            key={`event-${eventId}`}
            coordinate={coordinate}
            onPress={() => handlePinPress(eventId)}
            tracksViewChanges={false}
          >
            <View
              style={[
                styles.pinContainer,
                hostVerified && styles.pinVerifiedRing,
              ]}
            >
              <View style={styles.pinBody}>
                <Text style={styles.pinEmoji}>
                  {CATEGORY_EMOJI[category] ?? '📍'}
                </Text>
              </View>
              <View style={styles.pinTail} />
            </View>
          </Marker>
        );
      })
      .filter(Boolean);
  }, [clusters, handleClusterPress, handlePinPress]);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centeredFill}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  // ── Permission denied ─────────────────────────────────────────────────────

  if (permissionDenied) {
    return (
      <View style={[styles.fill, styles.centeredFill]}>
        <Text style={styles.permissionText}>
          NomadMeet needs your location to show events near you and let others
          find your events.
        </Text>
        <Pressable
          style={styles.permissionBtn}
          onPress={async () => {
            const { status } =
              await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
              setPermissionDenied(false);
              setIsLoading(true);
            }
          }}
        >
          <Text style={styles.permissionBtnText}>Allow Location</Text>
        </Pressable>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View style={styles.fill}>
      {/* ── Map Header ── */}
      <View style={[styles.mapHeader, { paddingTop: insets.top }]}>
        <View style={styles.mapHeaderSpacer} />
        <Text style={styles.appName}>Globe</Text>
        <View style={styles.mapHeaderActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
          >
            <Bell size={22} color={Colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setIsFilterModalVisible(true)}
            activeOpacity={0.7}
          >
            <SlidersHorizontal
              size={22}
              color={activeFilter !== 'all' ? Colors.accent : Colors.textPrimary}
              strokeWidth={2}
            />
          </TouchableOpacity>
        </View>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        showsUserLocation={false}
        initialRegion={
          region ?? {
            latitude: coordinates?.latitude ?? 0,
            longitude: coordinates?.longitude ?? 0,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          }
        }
        onRegionChangeComplete={handleRegionChangeComplete}
        showsMapToolbar={false}
      >
        {renderedMarkers}

        {/* Custom user location dot — replaces showsUserLocation which crashes
            on RN 0.76 Fabric with "topUserLocationChange" event errors. */}
        {coordinates && (
          <Marker
            coordinate={coordinates}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.userDotOuter}>
              <View style={styles.userDotInner} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Empty state */}
      {events.length === 0 && (
        <View style={styles.emptyBanner} pointerEvents="none">
          <Text style={styles.emptyText}>
            No events nearby. Drop a pin to start one!
          </Text>
        </View>
      )}

      {/* Event preview sheet — always mounted, animates in/out on pin tap */}
      <EventCard
        event={selectedEvent}
        onDismiss={() => setSelectedEvent(null)}
      />

      {/*
       * FAB — hidden while the EventCard sheet is open so it doesn't bleed
       * on top of the sheet content. Becomes visible again on dismiss.
       * Z-index discipline: sheet sits at a higher elevation than the FAB,
       * but hiding is cleaner than fighting elevation stacking on Android.
       */}
      {!selectedEvent && (
        <>
          {/* Recenter FAB — snaps map back to current GPS position */}
          <Pressable
            style={styles.recenterFab}
            onPress={handleRecenter}
            accessibilityLabel="Recenter map"
            accessibilityRole="button"
          >
            <LocateFixed color={Colors.textPrimary} size={20} strokeWidth={2} />
          </Pressable>

          {/* Create event FAB */}
          <Pressable
            style={styles.fab}
            onPress={() => router.push('/event/create')}
            accessibilityLabel="Create event"
            accessibilityRole="button"
          >
            <Plus color={Colors.white} size={28} strokeWidth={2.5} />
          </Pressable>
        </>
      )}

      {/* ── Filter Modal ── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isFilterModalVisible}
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        {/* Semi-transparent backdrop — tap to dismiss */}
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsFilterModalVisible(false)}
        />

        {/* Bottom sheet */}
        <View style={[styles.filterSheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.filterHandle} />
          <Text style={styles.filterTitle}>Filter Events</Text>

          {FILTER_OPTIONS.map(option => {
            const isActive = activeFilter === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.filterRow, isActive && styles.filterRowActive]}
                onPress={() => {
                  setActiveFilter(option.value);
                  setIsFilterModalVisible(false);
                  console.log('Filter changed:', option.value);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterRowLabel, isActive && styles.filterRowLabelActive]}>
                  {option.label}
                </Text>
                {isActive && (
                  <Check size={18} color={Colors.accent} strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>
    </View>
  );
}
