export type VerificationStatus = 'none' | 'pending' | 'rejected' | 'verified';

export interface Profile {
  id: string;
  display_name: string | null;
  country_code: string | null;
  avatar_url: string | null;
  bio: string | null;
  instagram_handle: string | null;
  travel_styles: string[];
  languages: string[];
  visited_countries: string[];
  verification_status: VerificationStatus;
  push_token: string | null;
  events_hosted_count: number;
  setup_completed: boolean;
  created_at: string;
}

export interface Country {
  code: string;
  name: string;
  flag: string;
}

export type EventCategory =
  | 'beer'
  | 'food'
  | 'sightseeing'
  | 'adventure'
  | 'culture'
  | 'other';

export type EventStatus = 'active' | 'expired';

/** Raw row returned by the `get_nearby_events` RPC or a Realtime change payload.
 *
 * `location` is a union because the two sources serialize differently:
 *   - RPC / REST select: PostgREST casts PostGIS geography → GeoJSON object
 *   - Realtime (postgres_changes): delivers the raw EWKB hex string
 *
 * Use `parseDBEventLocation()` in the map screen to handle both shapes. */
export interface DBEvent {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  location:
    | { type: 'Point'; coordinates: [number, number] } // [lng, lat] — from RPC/REST
    | string;                                           // EWKB hex   — from Realtime
  status: EventStatus;
  verified_only: boolean;
  participant_count: number;
  max_participants: number | null;
  expires_at: string;
  maps_taps: number;
  arrivals: number;
  post_event_messages: number;
  created_at: string;
}

/** Client-side event — `location` WKB already parsed into lat/lon. */
export interface Event extends Omit<DBEvent, 'location'> {
  latitude: number;
  longitude: number;
}
