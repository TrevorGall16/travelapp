// lib/mapGeo.ts — Pure geo utilities and Supercluster types for the Map screen.

import Supercluster from 'supercluster';
import type { DBEvent, Event, EventCategory } from '../types';

/** Haversine distance between two lat/lon points, in metres. */
export function haversineMeters(
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
export function regionToZoom(longitudeDelta: number): number {
  if (longitudeDelta <= 0) return 15;
  return Math.max(0, Math.min(20, Math.round(Math.log2(360 / longitudeDelta))));
}

/**
 * Parses a PostGIS EWKB hex string into [longitude, latitude].
 *
 * Realtime `postgres_changes` payloads deliver geography/geometry columns as
 * raw EWKB hex (e.g. "0101000020E6100000...") rather than GeoJSON, so we
 * decode it here using a pure DataView approach (no Node.js Buffer needed).
 *
 * EWKB little-endian layout:
 *   [1 byte]  byte-order flag  (0x01 = LE)
 *   [4 bytes] type (Point = 1, with optional SRID flag 0x20000000)
 *   [4 bytes] SRID (only present when SRID flag is set)
 *   [8 bytes] X / longitude (IEEE-754 double)
 *   [8 bytes] Y / latitude  (IEEE-754 double)
 */
export function parseWKBHex(hex: string): [number, number] | null {
  try {
    if (!hex || hex.length < 42) return null;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    const view = new DataView(bytes.buffer);
    const le = bytes[0] === 0x01;
    const typeRaw = view.getUint32(1, le);
    const hasSRID = (typeRaw & 0x20000000) !== 0;
    const coordOffset = 1 + 4 + (hasSRID ? 4 : 0);
    const lng = view.getFloat64(coordOffset, le);
    const lat = view.getFloat64(coordOffset + 8, le);
    return [lng, lat];
  } catch {
    return null;
  }
}

/**
 * Maps a raw DBEvent row to a parsed Event.
 *
 * Handles two `location` shapes:
 *   1. GeoJSON object `{ type: 'Point', coordinates: [lng, lat] }` — from RPC/REST
 *   2. EWKB hex string                                              — from Realtime
 *
 * Returns null if coordinates are missing or non-finite.
 */
export function dbEventToEvent(row: DBEvent): Event | null {
  let longitude: number;
  let latitude: number;

  if (typeof row.location === 'string') {
    // Realtime path — EWKB hex
    const coords = parseWKBHex(row.location);
    if (!coords) return null;
    [longitude, latitude] = coords;
  } else {
    // RPC / REST path — GeoJSON object
    // parseFloat guards against coords arriving as strings from Supabase RPC
    longitude = parseFloat(row.location.coordinates[0] as any);
    latitude = parseFloat(row.location.coordinates[1] as any);
  }

  if (!isFinite(latitude) || !isFinite(longitude)) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { location: _loc, ...rest } = row;
  return { ...rest, latitude, longitude };
}

// ─── Supercluster types ────────────────────────────────────────────────────────

export interface PinProperties {
  eventId: string;
  category: EventCategory;
  title: string;
  participantCount: number;
  expiresAt: string;
  // TODO: join with profiles to populate once host verification is exposed by RPC
  hostVerified: boolean;
  // TODO: populate from RPC join on profiles once available
  hostAvatarUrl: string | null;
}

export type ClusterOutput =
  | Supercluster.ClusterFeature<Supercluster.AnyProps>
  | Supercluster.PointFeature<PinProperties>;

export function eventsToGeoFeatures(
  events: Event[],
): Supercluster.PointFeature<PinProperties>[] {
  // ── Radical Splatter Spiderfier ────────────────────────────────────────────
  //
  // SPIDER_RADIUS = 0.001° ≈ 110 m at equator.
  // For 2 co-located events: fanned at 0° and 180° → 220 m apart.
  // This guarantees unmistakably separate pins on screen and makes
  // Android's marker disambiguation popup physically impossible.
  //
  // Grouping uses each event's raw coordinates (no grid snapping).
  // Events at identical coords get fanned out; events at different
  // coords pass through unmodified.

  const SPIDER_RADIUS = 0.001; // ~110 m at equator

  // ── Pass 1: group by exact coordinate ──────────────────────────────────────
  const groups = new Map<string, number[]>();
  events.forEach((e, i) => {
    const key = `${e.latitude},${e.longitude}`;
    const arr = groups.get(key);
    if (arr) arr.push(i);
    else groups.set(key, [i]);
  });

  // ── Pass 2: build features — fan out co-located groups ─────────────────────
  const result: Supercluster.PointFeature<PinProperties>[] = new Array(events.length);

  for (const indices of groups.values()) {
    const n = indices.length;

    if (n === 1) {
      const e = events[indices[0]];
      result[indices[0]] = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [e.longitude, e.latitude] },
        properties: {
          eventId: e.id,
          category: e.category,
          title: e.title,
          participantCount: e.participant_count,
          expiresAt: e.expires_at,
          hostVerified: false,
          hostAvatarUrl: null,
        },
      };
      continue;
    }

    // Fan ALL members outward from their shared coordinate.
    // 2 pins → 0° and 180° (maximum separation = 2 × SPIDER_RADIUS ≈ 220 m).
    // 3+ pins → evenly distributed around the circle.
    const cLat = events[indices[0]].latitude;
    const cLon = events[indices[0]].longitude;

    indices.forEach((idx, pos) => {
      const e = events[idx];
      const angle = (2 * Math.PI * pos) / n;
      const ring = Math.floor(pos / 6) + 1;
      const lat = cLat + ring * SPIDER_RADIUS * Math.cos(angle);
      const lon = cLon + ring * SPIDER_RADIUS * Math.sin(angle);

      result[idx] = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          eventId: e.id,
          category: e.category,
          title: e.title,
          participantCount: e.participant_count,
          expiresAt: e.expires_at,
          hostVerified: false,
          hostAvatarUrl: null,
        },
      };
    });
  }

  return result;
}
