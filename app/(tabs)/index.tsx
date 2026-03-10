import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated as RNAnimated,
  FlatList,
  Linking,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, {
  Marker,
  type Region,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import * as Location from 'expo-location';
import Supercluster from 'supercluster';
import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, Check, List, LocateFixed, MapPin, Plus, SlidersHorizontal } from 'lucide-react-native';

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
import { CATEGORY_EMOJI } from '../../constants/categories';
import { TAB_CONTENT_HEIGHT } from './_layout';

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const { coordinates, city, setCoordinates, setPermissionStatus, setCity } =
    useLocationStore();
  const {
    events, mapKey, setEvents, addEvent, updateEvent, removeEvent,
    blockedUserIds, setBlockedUserIds, getVisibleEvents,
  } = useMapStore();

  const [isLoading, setIsLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [clusters, setClusters] = useState<ClusterOutput[]>([]);
  const [region, setRegion] = useState<Region | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  // Flips true after onMapReady + requestAnimationFrame, proving tiles can render.
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [isListVisible, setIsListVisible] = useState(false);

  // ── Sonar pulse animation ──────────────────────────────────────────────────
  const pulseAnim = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.timing(pulseAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.3],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const mapRef = useRef<MapView>(null);
  const lastFetchRef = useRef<{ latitude: number; longitude: number } | null>(
    null,
  );
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Supercluster — "brittle" config: clusters shatter early, pins stay apart.
  // maxZoom: 13  — clusters dissolve by zoom 13; zoom 14+ always shows pins.
  // radius: 20   — weak merge pull; nearby events resist clustering.
  // extent: 1024 — maximum tile precision for sharper split boundaries.
  const SC_MAX_ZOOM = 13;
  const SC_OPTS = { radius: 20, maxZoom: SC_MAX_ZOOM, extent: 1024 };
  const sc = useRef(
    new Supercluster<PinProperties>(SC_OPTS),
  );
  const lastMapKeyRef = useRef(mapKey);

  // ── RPC fetch ──────────────────────────────────────────────────────────────

  const fetchEvents = useCallback(
    async (lat: number, lon: number) => {
      console.log('[Map Fetch] Payload:', { user_lat: lat, user_lon: lon, radius_meters: FETCH_RADIUS_METERS });

      const { data, error } = await supabase.rpc('get_events_within_radius', {
        user_lat: lat,
        user_lon: lon,
        radius_meters: FETCH_RADIUS_METERS,
      });

      console.log('[Map Fetch] Result: rows =', Array.isArray(data) ? data.length : data,
        '| error =', error?.message ?? null,
        '| first row =', Array.isArray(data) && data.length > 0 ? JSON.stringify(data[0]) : 'none',
      );

      if (error) {
        console.error('[Map] get_events_within_radius error:', error.message, error.details);
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
    (r: Region, evts: Event[], currentMapKey: number) => {
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

      // Rebuild the Supercluster instance when mapKey changes to force a clean KD-tree
      if (currentMapKey !== lastMapKeyRef.current) {
        sc.current = new Supercluster<PinProperties>(SC_OPTS);
        lastMapKeyRef.current = currentMapKey;
      }

      const zoom = Math.max(0, Math.min(20, Math.round(Math.log2(360 / longitudeDelta))));
      const bbox: [number, number, number, number] = [
        longitude - longitudeDelta / 2,
        latitude - latitudeDelta / 2,
        longitude + longitudeDelta / 2,
        latitude + latitudeDelta / 2,
      ];

      // At zoom >= 14 (past SC_MAX_ZOOM=13), bypass supercluster entirely
      // and render raw spiderfied features.  Co-located pins are offset by
      // ~110 m (SPIDER_RADIUS=0.001), guaranteeing wide visual separation.
      if (zoom >= 14) {
        const features = eventsToGeoFeatures(evts);
        // Filter to bbox
        const visible = features.filter((f) => {
          const [fLon, fLat] = f.geometry.coordinates;
          return fLon >= bbox[0] && fLon <= bbox[2] && fLat >= bbox[1] && fLat <= bbox[3];
        });
        setClusters(visible as ClusterOutput[]);
        return;
      }

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

  // ── Re-fetch on tab focus (kills ghost pins after DB wipes) ──────────────

  useFocusEffect(
    useCallback(() => {
      // lastFetchRef is null until the init useEffect completes its first fetch,
      // so this is a no-op on the very first render — init already handles that.
      if (!lastFetchRef.current) return;
      const { latitude, longitude } = lastFetchRef.current;
      fetchEvents(latitude, longitude);
    }, [fetchEvents]),
  );

  // ── Realtime subscription ─────────────────────────────────────────────────

  const subscribeRealtime = useCallback(
    (userCoords: { latitude: number; longitude: number }, userCity: string | null) => {
      // Tear down any existing channel before creating a fresh one
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // When the user's city is known, scope the Realtime subscription
      // server-side so only events in the same city are delivered.
      // Falls back to unfiltered + client-side radius guard when city is null.
      const filterClause = userCity ? `city=eq.${userCity}` : undefined;

      const channel = supabase
        .channel('events-map')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'events', ...(filterClause ? { filter: filterClause } : {}) },
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
          { event: 'UPDATE', schema: 'public', table: 'events', ...(filterClause ? { filter: filterClause } : {}) },
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
          { event: 'DELETE', schema: 'public', table: 'events', ...(filterClause ? { filter: filterClause } : {}) },
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

      // ── Request location permission ────────────────────────────────────────
      let status: Location.PermissionStatus;
      try {
        const res = await Location.requestForegroundPermissionsAsync();
        status = res.status;
      } catch (err) {
        console.warn('[Map] Permission request threw:', err);
        status = Location.PermissionStatus.DENIED;
      }

      if (isMounted) setPermissionStatus(status);

      if (status !== Location.PermissionStatus.GRANTED) {
        if (isMounted) {
          setPermissionDenied(true);
          setIsLoading(false);
        }
        return;
      }

      // ── Get current position ────────────────────────────────────────────────
      let latitude: number;
      let longitude: number;
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch (err) {
        console.warn('[Map] getCurrentPositionAsync failed, falling back to last known:', err);
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          latitude = last.coords.latitude;
          longitude = last.coords.longitude;
        } else {
          // Hard fallback — central Paris
          latitude = 48.8566;
          longitude = 2.3522;
        }
      }
      setCoordinates({ latitude, longitude });

      // ── Reverse-geocode for city ────────────────────────────────────────────
      let detectedCity: string | null = null;
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
        detectedCity = place?.city ?? place?.district ?? place?.subregion ?? null;
      } catch { /* keep null */ }
      if (isMounted) setCity(detectedCity);

      await fetchEvents(latitude, longitude);
      if (!isMounted) return;

      subscribeRealtime({ latitude, longitude }, detectedCity);

      const initialRegion: Region = {
        latitude,
        longitude,
        latitudeDelta: 0.09,
        longitudeDelta: 0.09,
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
              // Re-geocode to detect city change
              let newCity = detectedCity;
              try {
                const [place] = await Location.reverseGeocodeAsync({ latitude: newLat, longitude: newLon });
                newCity = place?.city ?? place?.district ?? place?.subregion ?? null;
                if (isMounted) setCity(newCity);
              } catch { /* keep previous city */ }

              await fetchEvents(newLat, newLon);
              if (isMounted) {
                subscribeRealtime({ latitude: newLat, longitude: newLon }, newCity);
                detectedCity = newCity;
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

  // ── Fetch blocked user IDs (for pin filtering) ───────────────────────────
  useEffect(() => {
    const { user } = useAuthStore.getState();
    if (!user) return;
    supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id)
      .then(({ data }) => {
        if (data) {
          setBlockedUserIds(new Set(data.map((r: { blocked_id: string }) => r.blocked_id)));
        }
      });
  }, [setBlockedUserIds]);

  // Use filtered events for rendering (hides blocked users' pins)
  const visibleEvents = getVisibleEvents();

  // Recompute clusters whenever the event list or visible region changes
  useEffect(() => {
    if (region) recomputeClusters(region, visibleEvents, mapKey);
  }, [visibleEvents, region, mapKey, recomputeClusters]);

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleRegionChangeComplete = useCallback(
    (newRegion: Region) => {
      setRegion(newRegion);
      recomputeClusters(newRegion, visibleEvents, mapKey);
    },
    [visibleEvents, mapKey, recomputeClusters],
  );

  const handleClusterPress = useCallback(
    (clusterId: number, coordinate: { latitude: number; longitude: number }) => {
      if (!mapRef.current || !region) return;
      const leaves = sc.current.getLeaves(clusterId, Infinity);
      if (leaves.length === 0) return;

      // Natural zoom: step in by at most +2 zoom levels for a fluid transition
      // instead of an aggressive jump to the cluster's full expansion zoom.
      const currentZoom = Math.max(0, Math.min(20, Math.round(Math.log2(360 / region.longitudeDelta))));
      const expansionZoom = sc.current.getClusterExpansionZoom(clusterId);
      const targetZoom = Math.min(expansionZoom, currentZoom + 2);
      const targetDelta = 360 / Math.pow(2, targetZoom);

      mapRef.current.animateToRegion(
        {
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          latitudeDelta: targetDelta,
          longitudeDelta: targetDelta,
        },
        400,
      );
    },
    [region],
  );

  const handlePinPress = useCallback(
    (eventId: string) => {
      const found = visibleEvents.find((e) => e.id === eventId) ?? null;
      setSelectedEvent(found);
    },
    [visibleEvents],
  );

  const handleRecenter = useCallback(() => {
    if (!coordinates || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        latitudeDelta: 0.09,
        longitudeDelta: 0.09,
      },
      500,
    );
  }, [coordinates]);

const handleMapReady = useCallback(() => {
    // requestAnimationFrame ensures the native view is fully laid out
    requestAnimationFrame(() => {
      setTilesLoaded(true);

      // Force a tiny 1-meter shift to "wake up" the GPU tile-painting engine
      if (mapRef.current && coordinates) {
        mapRef.current.animateToRegion({
          latitude: coordinates.latitude,
          longitude: coordinates.longitude + 0.000001,
          latitudeDelta: 0.09,
          longitudeDelta: 0.09,
        }, 100);
      }
    });
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
              zIndex={100}
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

        // Individual event pin — avatar-circle style
        const { eventId, category, hostVerified } =
          feature.properties as PinProperties;
        return (
          <Marker
            key={`event-${eventId}`}
            coordinate={coordinate}
            zIndex={1}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handlePinPress(eventId);
            }}
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

  // ── Permission denied — slick overlay ─────────────────────────────────────

  if (permissionDenied) {
    return (
      <View style={[styles.fill, styles.centeredFill]}>
        <View style={styles.permissionIconWrap}>
          <MapPin size={36} color={Colors.accent} strokeWidth={2} />
        </View>
        <Text style={styles.permissionTitle}>Spot on the map</Text>
        <Text style={styles.permissionText}>
          We need your location to show who's nearby.
        </Text>
        <Pressable
          style={styles.permissionBtn}
          onPress={async () => {
            try {
              const { status } =
                await Location.requestForegroundPermissionsAsync();
              if (status === Location.PermissionStatus.GRANTED) {
                setPermissionDenied(false);
                setIsLoading(true);
              } else {
                // OS won't re-prompt — send user to Settings
                Linking.openSettings();
              }
            } catch {
              Linking.openSettings();
            }
          }}
        >
          <Text style={styles.permissionBtnText}>Allow Location</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openSettings()}>
          <Text style={styles.permissionSettingsLink}>Open Settings</Text>
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
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/notifications');
            }}
          >
            <Bell size={22} color={Colors.textPrimary} strokeWidth={2} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsListVisible(true);
            }}
          >
            <List size={22} color={Colors.textPrimary} strokeWidth={2} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsFilterModalVisible(true);
            }}
          >
            <SlidersHorizontal
              size={22}
              color={activeFilter !== 'all' ? Colors.accent : Colors.textPrimary}
              strokeWidth={2}
            />
          </Pressable>
        </View>
      </View>

      {/* Map container — red bg for debugging (visible = container renders, tiles don't) */}
      <View style={styles.mapContainer}>
        <View style={styles.mapAbsoluteFill}>
{/* @ts-ignore — Android-only prop suppression */}
<MapView
          key={mapKey}
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          googleRenderer="LATEST"
          mapType="standard"
          showsUserLocation={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          initialRegion={
            region ?? {
              latitude: coordinates?.latitude ?? 48.8566,
              longitude: coordinates?.longitude ?? 2.3522,
              latitudeDelta: 0.09,
              longitudeDelta: 0.09,
            }
          }
          onMapReady={handleMapReady}
          onRegionChangeComplete={handleRegionChangeComplete}
        >
          {tilesLoaded && renderedMarkers}

          {/* Custom user location dot with sonar pulse */}
          {tilesLoaded && coordinates && (
            <Marker
              coordinate={coordinates}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={true}
            >
              <View style={styles.userDotContainer}>
                <RNAnimated.View
                  style={[
                    styles.userDotPulse,
                    {
                      transform: [{ scale: pulseScale }],
                      opacity: pulseOpacity,
                    },
                  ]}
                />
                <View style={styles.userDotOuter}>
                  <View style={styles.userDotInner} />
                </View>
              </View>
            </Marker>
          )}
        </MapView>
        </View>
      </View>

      {/* Empty state */}
      {visibleEvents.length === 0 && (
        <View style={styles.emptyBanner} pointerEvents="none">
          <Text style={styles.emptyText}>
            Nothing nearby yet. Drop the first pin.
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
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleRecenter();
            }}
            accessibilityLabel="Recenter map"
            accessibilityRole="button"
          >
            <LocateFixed color={Colors.textPrimary} size={20} strokeWidth={2} />
          </Pressable>

          {/* Create event FAB */}
          <Pressable
            style={styles.fab}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/event/create');
            }}
            accessibilityLabel="Create event"
            accessibilityRole="button"
          >
            <Plus color={Colors.white} size={28} strokeWidth={2.5} />
          </Pressable>
        </>
      )}

      {/* ── List View Modal ── */}
      <Modal
        animationType="slide"
        transparent
        visible={isListVisible}
        onRequestClose={() => setIsListVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsListVisible(false)}
        />
        <View style={[styles.filterSheet, { paddingBottom: insets.bottom + TAB_CONTENT_HEIGHT, maxHeight: '75%' }]}>
          <View style={styles.filterHandle} />
          <Text style={styles.filterTitle}>Nearby Events</Text>
          <FlatList
            data={
              coordinates
                ? [...visibleEvents].sort(
                    (a, b) =>
                      haversineMeters(coordinates.latitude, coordinates.longitude, a.latitude, a.longitude) -
                      haversineMeters(coordinates.latitude, coordinates.longitude, b.latitude, b.longitude),
                  )
                : visibleEvents
            }
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const dist = coordinates
                ? haversineMeters(coordinates.latitude, coordinates.longitude, item.latitude, item.longitude)
                : null;
              const distLabel =
                dist !== null
                  ? dist < 1000
                    ? `${Math.round(dist)} m`
                    : `${(dist / 1000).toFixed(1)} km`
                  : '';
              return (
                <Pressable
                  style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsListVisible(false);
                    setSelectedEvent(item);
                  }}
                >
                  <Text style={styles.listRowEmoji}>{CATEGORY_EMOJI[item.category] ?? '📍'}</Text>
                  <View style={styles.listRowContent}>
                    <Text style={styles.listRowTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.listRowMeta}>
                      {distLabel}{distLabel ? ' · ' : ''}{item.participant_count} joined
                    </Text>
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No events nearby.</Text>
            }
          />
        </View>
      </Modal>

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
          <Text style={styles.filterTitle}>Filter</Text>

          {FILTER_OPTIONS.map(option => {
            const isActive = activeFilter === option.value;
            return (
              <Pressable
                key={option.value}
                style={({ pressed }) => [
                  styles.filterRow,
                  isActive && styles.filterRowActive,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveFilter(option.value);
                  setIsFilterModalVisible(false);
                }}
              >
                <Text style={[styles.filterRowLabel, isActive && styles.filterRowLabelActive]}>
                  {option.label}
                </Text>
                {isActive && (
                  <Check size={18} color={Colors.accent} strokeWidth={2.5} />
                )}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </View>
  );
}
