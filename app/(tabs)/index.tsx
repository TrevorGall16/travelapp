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
  StyleSheet,
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
import { Bell, Check, Plus, SlidersHorizontal } from 'lucide-react-native';

import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useLocationStore } from '../../stores/locationStore';
import { useMapStore } from '../../stores/mapStore';
import EventCard from '../../components/map/EventCard';
import { Colors } from '../../constants/theme';
import type { DBEvent, Event, EventCategory } from '../../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

// ─── Geo utilities ────────────────────────────────────────────────────────────

/** Haversine distance between two lat/lon points, in metres. */
function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Converts a map region's longitudeDelta to an integer zoom level [0–20]. */
function regionToZoom(longitudeDelta: number): number {
  if (longitudeDelta <= 0) return 15;
  return Math.max(0, Math.min(20, Math.round(Math.log2(360 / longitudeDelta))));
}

/** Maps a raw DBEvent row to a parsed Event. Returns null if coords are invalid. */
function dbEventToEvent(row: DBEvent): Event | null {
  const [longitude, latitude] = row.location.coordinates;
  if (!isFinite(latitude) || !isFinite(longitude)) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { location: _loc, ...rest } = row;
  return { ...rest, latitude, longitude };
}

// ─── Supercluster types ────────────────────────────────────────────────────────

interface PinProperties {
  eventId: string;
  category: EventCategory;
  title: string;
  participantCount: number;
  expiresAt: string;
  // TODO: join with profiles to populate once host verification is exposed by RPC
  hostVerified: boolean;
}

type ClusterOutput =
  | Supercluster.ClusterFeature<Supercluster.AnyProps>
  | Supercluster.PointFeature<PinProperties>;

function eventsToGeoFeatures(
  events: Event[],
): Supercluster.PointFeature<PinProperties>[] {
  return events.map((e) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [e.longitude, e.latitude] },
    properties: {
      eventId: e.id,
      category: e.category,
      title: e.title,
      participantCount: e.participant_count,
      expiresAt: e.expires_at,
      hostVerified: false,
    },
  }));
}

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
    new Supercluster<PinProperties>({ radius: 60, maxZoom: 20 }),
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
      const parsed: Event[] = ((data ?? []) as DBEvent[])
        .map(dbEventToEvent)
        .filter((e): e is Event => e !== null);

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

      const zoom = regionToZoom(longitudeDelta);
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
            onPress={() => console.log('Open Notifications')}
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
        <Pressable
          style={styles.fab}
          onPress={() => router.push('/event/create')}
          accessibilityLabel="Create event"
          accessibilityRole="button"
        >
          <Plus color={Colors.white} size={28} strokeWidth={2.5} />
        </Pressable>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: Colors.background },
  centeredFill: { justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  map: { flex: 1 },

  // Map header bar
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    zIndex: 20,
  },
  mapHeaderSpacer: {
    flex: 1,
  },
  appName: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  mapHeaderActions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 8,
  },

  // Cluster bubble
  clusterMarker: {
    backgroundColor: Colors.accent,
    borderRadius: 24,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
    shadowColor: Colors.background,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  clusterCount: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },

  // Individual pin (teardrop: circle body + triangular tail)
  pinContainer: {
    alignItems: 'center',
  },
  pinVerifiedRing: {
    borderRadius: 28,
    borderWidth: 2.5,
    borderColor: Colors.accent,
    padding: 2,
  },
  pinBody: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.background,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  pinEmoji: { fontSize: 22 },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: Colors.transparent,
    borderRightColor: Colors.transparent,
    borderTopColor: Colors.surface,
    marginTop: -1,
  },

  // Empty state — sits just below the map header, well above the FAB
  emptyBanner: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: Colors.overlayStrong,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },

  // FAB — z-index: rendered conditionally (hidden when EventCard sheet is open)
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 116 : 96,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },

  // Permission denied
  permissionText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 26,
  },
  permissionBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // Custom user location dot (replaces native showsUserLocation)
  userDotOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accentSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.white,
  },

  // ── Filter Modal ──────────────────────────────────────────────
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  filterSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  filterHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  filterRowActive: {
    // No background change — checkmark + accent text convey selection
  },
  filterRowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  filterRowLabelActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
});
