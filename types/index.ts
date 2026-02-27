export type VerificationStatus = 'none' | 'pending' | 'rejected' | 'verified';

export interface Profile {
  id: string;
  display_name: string;
  country_code: string;
  avatar_url: string;
  bio: string | null;
  instagram_handle: string | null;
  verification_status: VerificationStatus;
  push_token: string | null;
  events_hosted_count: number;
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

/** Raw row returned by the `get_events_within_radius` RPC.
 *  The PostGIS `location` column comes back as a hex EWKB string. */
export interface DBEvent {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  location: string; // hex EWKB — parse with parsePointFromWKB()
  status: EventStatus;
  verified_only: boolean;
  participant_count: number;
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
