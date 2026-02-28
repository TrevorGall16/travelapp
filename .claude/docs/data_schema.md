# DATA_SCHEMA.md

**For:** Builder AI  
**Project:** Solo Travel Social App (NomadMeet - Working Title)  
**Purpose:** Define the exact PostgreSQL tables, enums, extensions, and triggers required in Supabase. The Builder AI must execute this exact SQL to initialize the database.

---

## 1. EXTENSIONS & ENUMS

The database must use PostGIS for spatial queries. Enums strictly lock down allowed values to prevent dirty data.

```sql
-- Enable PostGIS for geographic data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Define strict enums
CREATE TYPE event_category AS ENUM ('beer', 'food', 'sightseeing', 'adventure', 'culture', 'other');
CREATE TYPE verification_status AS ENUM ('none', 'pending', 'rejected', 'verified');
CREATE TYPE event_status AS ENUM ('active', 'expired');

```

---

## 2. CORE TABLES

### 2.1 Profiles Table

Stores user data. Connected 1-to-1 with Supabase Auth (`auth.users`).

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name VARCHAR(20) NOT NULL,
  country_code VARCHAR(2) NOT NULL, -- ISO 3166-1 alpha-2
  avatar_url TEXT NOT NULL,
  bio VARCHAR(160),
  instagram_handle VARCHAR(30),
  verification_status verification_status DEFAULT 'none'::verification_status,
  push_token TEXT,
  events_hosted_count INTEGER DEFAULT 0,
  setup_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

```

> **`setup_completed` — Onboarding Guard (Critical)**
>
> `display_name`, `country_code`, and `avatar_url` are all `NOT NULL`, so the
> `handle_new_user()` trigger must inject placeholder values (e.g. pulling
> `display_name` from Google OAuth metadata) to satisfy Postgres on signup.
> This makes string-based "is the profile real?" checks unreliable.
>
> `setup_completed BOOLEAN DEFAULT FALSE` is the **sole authoritative signal**
> that a user has finished onboarding. It defaults to `FALSE` on every
> trigger-created row and is only set to `TRUE` by `app/(auth)/setup.tsx` on
> the final `.update()` call when the user completes Step 2.
>
> The navigation guard in `app/_layout.tsx` (`isProfileComplete()`) checks
> **only this boolean** — never the string fields — when deciding whether to
> allow access to `/(tabs)/`.
>
> **Migration (already applied):**
> ```sql
> ALTER TABLE profiles
>   ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN NOT NULL DEFAULT FALSE;
> ```

### 2.2 Events Table

The core discovery model. Uses PostGIS `GEOMETRY(Point, 4326)` for the pin location.

```sql
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(60) NOT NULL,
  description VARCHAR(300),
  category event_category NOT NULL,
  location GEOMETRY(Point, 4326) NOT NULL, -- PostGIS coordinate
  status event_status DEFAULT 'active'::event_status,
  verified_only BOOLEAN DEFAULT FALSE,
  participant_count INTEGER DEFAULT 1, -- Starts at 1 (the host)
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Passive Analytics
  maps_taps INTEGER DEFAULT 0,
  arrivals INTEGER DEFAULT 0,
  post_event_messages INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast radius queries
CREATE INDEX events_location_idx ON events USING GIST (location);
CREATE INDEX events_status_idx ON events(status);

```

### 2.3 Event Participants Table

Junction table tracking who is in which event.

```sql
CREATE TABLE event_participants (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

```

---

## 3. MODERATION TABLES

### 3.1 Reports Table

For manual admin review via Supabase Studio.

```sql
CREATE TABLE reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  reason VARCHAR(50) NOT NULL,
  description VARCHAR(200),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

```

### 3.2 Blocks Table

Global blocking system.

```sql
CREATE TABLE blocks (
  blocker_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

```

---

## 4. DATABASE TRIGGERS (CRITICAL LOGIC)

The Builder AI MUST implement this trigger to handle the `participant_count` on the `events` table automatically. The client app should never update this count directly.

```sql
-- 1. Create the function
CREATE OR REPLACE FUNCTION update_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE events SET participant_count = participant_count + 1 WHERE id = NEW.event_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE events SET participant_count = participant_count - 1 WHERE id = OLD.event_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Bind it to the table
CREATE TRIGGER trigger_update_participant_count
AFTER INSERT OR DELETE ON event_participants
FOR EACH ROW
EXECUTE FUNCTION update_participant_count();

```

---

## 5. RPC FUNCTIONS

The client uses this function to fetch initial events within the 5km discovery radius without downloading the entire global database.

```sql
CREATE OR REPLACE FUNCTION get_events_within_radius(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION DEFAULT 5000
)
RETURNS SETOF events AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM events
  WHERE status = 'active'
    AND ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography,
      radius_meters
    );
END;
$$ LANGUAGE plpgsql;

```

*End of Data Schema Document*
