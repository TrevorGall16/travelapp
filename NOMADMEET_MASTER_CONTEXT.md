# NOMADMEET MASTER CONTEXT

**Purpose:** Universal project document for any new AI architect. Contains every technical nuance required to continue building NomadMeet without asking a single clarifying question.
**Last Updated:** 2026-03-06
**Working Directory:** `D:\Projects\travelapp`

---

## TABLE OF CONTENTS

1. [Project Identity](#1-project-identity)
2. [Architectural Map](#2-architectural-map)
3. [The Battle-Tested Environment](#3-the-battle-tested-environment)
4. [The Logic Brain (Current Build Status)](#4-the-logic-brain)
5. [Testing Protocol](#5-testing-protocol)
6. [File Map (Every Important File)](#6-file-map)
7. [Hard-Won Lessons (Fixed Ghosts)](#7-hard-won-lessons)

---

## 1. PROJECT IDENTITY

### 1.1 Core Value Prop

NomadMeet is a **solo travel social app** for backpackers, digital nomads, and solo travelers. Users drop ephemeral event pins on a map ("Beer at the hostel bar in 2 hours"), other travelers nearby see the pin, join, and meet in real life. Events expire (2h/4h/8h/tomorrow), keeping the map fresh and urgent.

Key differentiator: **Not a dating app. Not a travel planner.** It's a spontaneous "who's nearby right now?" coordination tool. Think Tinder-for-hanging-out, minus the swiping, plus a map.

### 1.2 "Slick" Design Standards

The app follows a premium dark-mode aesthetic. Every interaction should feel **tactile and alive**:

- **Glassmorphism:** `expo-blur` BlurView (intensity 80, tint `systemMaterialDark`) on the EventCard bottom sheet and edit profile header. Sheet backgrounds use `rgba(21,30,47,0.65)` with `overflow: 'hidden'` to contain the blur.
- **Haptics:** Every meaningful tap fires `expo-haptics`. Light impact for navigation/pin taps. Medium impact for FAB/create actions. `notificationAsync(Success)` on friend accept. `notificationAsync(Warning)` on report.
- **Fluid Motion:** Spring-based animations via `react-native-reanimated` (damping:15, stiffness:100, mass:0.8) for the photo Gallery. RN `Animated` API for the sonar pulse on the user location dot (scale 1.0->1.3, opacity 1->0, 2000ms loop). EventCard sheet uses spring `translateY` animation.
- **Sonar Pulse:** The user's location on the map is NOT the default blue dot. It's a custom `<Marker>` with a pulsing ring animation (`RNAnimated.loop` + timing). Defined in `styles/mapScreenStyles.ts` as `userDotContainer`, `userDotPulse`, `userDotOuter`, `userDotInner`.
- **Theme System:** All colors come from `constants/theme.ts`. **No raw hex codes in component files.** Exports: `Colors`, `Spacing`, `Radius`, `Shadows` (platform-aware), `STREAM_THEME`.
  - Primary background: `#0B1120` (slate-950)
  - Surface: `#151E2F` (slate-850)
  - Accent (electric blue): `#3B82F6` (blue-500)
  - Accent glow: `rgba(59,130,246,0.15)`

### 1.3 "Human" Copy Style

All user-facing text follows `/.claude/docs/copy_guidelines.md`. The core rule:

> "Would a real person actually phrase it like this?" If no, rewrite.

**Banned words:** Epic, Neon, Journey, Discover, Unlock, Elevate, Seamless, Curated.

**CTA rules:** Sound like something you'd say to a friend at a hostel:
- "Count me in." (not "Join Event")
- "Nothing nearby yet. Drop the first pin." (not "Discover amazing events!")
- "This one's over -- chat is read-only." (not "This event has ended.")
- "Couldn't save that. Try again?" (not "An unexpected error occurred.")

**The sniff test:** If it sounds like an airline safety card or a startup pitch deck, rewrite. If it sounds like a friend at a hostel bar, ship it.

---

## 2. ARCHITECTURAL MAP

### 2.1 Tech Stack (Exact Versions)

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | React Native + Expo | SDK 55 (`expo@^55.0.4`) | **Never eject.** No native code modifications. |
| Language | TypeScript | 5.9 | Strict mode. No `any` types. |
| Routing | Expo Router | 55 (file-based) | Deep linking via `expo-linking`. Scheme: `travelapp` |
| State | Zustand | 5.0 | **Only 3 global stores:** `authStore`, `locationStore`, `mapStore`. No Redux, no Context API. |
| Database | Supabase (PostgreSQL + PostGIS) | `@supabase/supabase-js@^2.98.0` | All location queries use PostGIS. Never calculate distances client-side. |
| Chat | Stream Chat | `stream-chat-expo@^8.13.4` | Handles all messages, attachments, polls. Supabase **never** stores chat content. |
| Maps | `react-native-maps` | 1.27 | Apple Maps on iOS, Google Maps on Android. **No Mapbox.** |
| Clustering | `supercluster` | 8.0 | 60fps target with up to 50 individual pins. |
| Animations | `react-native-reanimated` | 4.2 | Gallery spring gestures. |
| Blur | `expo-blur` | 55 | Glassmorphism on sheets/headers. |
| Haptics | `expo-haptics` | 55 | Tactile feedback on every meaningful interaction. |
| Forms | React Hook Form + Zod | 7.71 / 4.3 | Validate all inputs before Supabase/Stream calls. |
| Images | `expo-image` | 55 | **Never use RN's `<Image>`.** Aggressive caching. |
| Icons | `lucide-react-native` | 0.575 | |
| Dates | `date-fns` | 4.1 | **No Moment.js.** |
| Payments | RevenueCat | (not yet installed) | **No Stripe.** Apple/Google IAP only. |
| UI Libraries | **None** | - | Zero-UI-Library Policy. No Paper, Kitten, Tamagui, NativeBase. Everything from scratch. |

### 2.2 Data Schema

#### Tables (6 core + 2 social + 1 moderation)

**`profiles`** — 1:1 with `auth.users`. Created by `handle_new_user()` trigger on signup.
```
id (UUID PK → auth.users), display_name (VARCHAR 20, NOT NULL),
country_code (VARCHAR 2, NOT NULL), avatar_url (TEXT, NOT NULL),
bio (VARCHAR 160), instagram_handle (VARCHAR 30),
verification_status (ENUM: none/pending/rejected/verified),
push_token (TEXT), events_hosted_count (INT DEFAULT 0),
setup_completed (BOOLEAN DEFAULT FALSE), created_at (TIMESTAMPTZ),
travel_styles (TEXT[] DEFAULT '{}'), languages (TEXT[] DEFAULT '{}'),
visited_countries (TEXT[] DEFAULT '{}'), persona_tags (TEXT[] DEFAULT '{}'),
photo_urls (TEXT[] DEFAULT '{}')
```
- `setup_completed` is the **sole authoritative onboarding guard**. Never check string fields.
- `verification_status` and `events_hosted_count` are RLS-protected from client writes.

**`events`** — PostGIS `GEOMETRY(Point, 4326)` for pin location.
```
id (UUID PK), host_id (UUID FK → profiles), title (VARCHAR 60),
description (VARCHAR 300), category (ENUM: beer/food/sightseeing/adventure/culture/other),
location (GEOMETRY Point 4326), city (TEXT), status (ENUM: active/expired),
verified_only (BOOLEAN), participant_count (INT DEFAULT 0),
max_participants (INT), meetup_point_label (TEXT),
expires_at (TIMESTAMPTZ), maps_taps/arrivals/post_event_messages (INT),
created_at (TIMESTAMPTZ)
```
- `participant_count` is **server-authoritative** via DB trigger on `event_participants`. Client never writes it.
- `participant_count` inserted as 0 (not default 1) so the trigger correctly increments to 1 when the host's `event_participants` row is inserted.
- **No client DELETE policy.** Deletions must go through `delete-event` Edge Function.

**`event_participants`** — Junction table (event_id, user_id PK pair).

**`connections`** — Reciprocal friend/connection system.
```
id (UUID PK), user_id_1 (UUID FK), user_id_2 (UUID FK),
status (TEXT: 'pending'|'accepted'), created_at (TIMESTAMPTZ)
UNIQUE constraint: LEAST(user_id_1, user_id_2), GREATEST(user_id_1, user_id_2)
```
- `LEAST/GREATEST` unique constraint makes the row order-independent: (A,B) and (B,A) are the same.
- `user_id_1` is always the **requester**. `user_id_2` is the **receiver**.
- RLS: Only `user_id_2` can UPDATE (accept). Either party can DELETE (unfriend).

**`notifications`** — In-app notification feed.
```
id (UUID PK), user_id (UUID FK → profiles), type (TEXT: friend_request/request_accepted/event_invite/system),
from_user_id (UUID FK), event_id (UUID FK), body (TEXT), read (BOOLEAN DEFAULT false),
created_at (TIMESTAMPTZ)
```

**`user_blocks`** — Bidirectional user blocking.
```
id (UUID PK), blocker_id (UUID FK), blocked_id (UUID FK),
created_at (TIMESTAMPTZ), UNIQUE(blocker_id, blocked_id), CHECK(blocker_id <> blocked_id)
```

**`reports`** — User/message reports (admin review via Supabase Studio).
```
id (UUID PK), reporter_id (UUID FK), reported_user_id (UUID FK),
message_id (TEXT), channel_id (TEXT), reason (TEXT), details (TEXT),
created_at (TIMESTAMPTZ)
```

#### Key RPC Function

```sql
get_events_within_radius(user_lat, user_lon, radius_meters DEFAULT 5000)
  RETURNS SETOF events WHERE status='active' AND ST_DWithin(...)
```

#### Critical Triggers

1. **`handle_new_user()`** — Auth trigger. SECURITY DEFINER. Auto-creates profile row on signup with placeholder values from OAuth metadata.
2. **`update_participant_count()`** — AFTER INSERT OR DELETE on `event_participants`. Increments/decrements `events.participant_count`.

### 2.3 Zustand Stores (3 total, no more)

1. **`authStore`** (`stores/authStore.ts`) — Persisted via AsyncStorage. Fields: `user`, `profile`, `streamToken`, `isInitialized` (transient, never persisted). Actions: `setUser`, `setProfile`, `setStreamToken`, `setInitialized`, `clearAuth`.

2. **`locationStore`** (`stores/locationStore.ts`) — NOT persisted. Fields: `coordinates`, `permissionStatus`, `city`. Updated by `expo-location` watch in the map screen.

3. **`mapStore`** (`stores/mapStore.ts`) — NOT persisted. Fields: `events[]`, `filters {radius, category}`, `blockedUserIds: Set<string>`, `mapKey: number`. Key methods:
   - `setEvents/addEvent/updateEvent/removeEvent` — all increment `mapKey` to force supercluster rebuild.
   - `setBlockedUserIds(ids)` — sets the blocked user set + increments `mapKey`.
   - `getVisibleEvents()` — filters out events where `host_id` is in `blockedUserIds`. **All rendering code must use this, never raw `events`.**

### 2.4 Deterministic DM Channel IDs

Private DM channels between two users use a deterministic ID to ensure both users always reach the same channel:

```typescript
const channelId = `dm_${[myId, otherId].sort().join('_')}`;
```

Sorting the UIDs alphabetically before joining guarantees that `dm_A_B` and `dm_B_A` always resolve to the same string. The channel is created lazily on first message via `streamClient.channel('messaging', channelId)`.

**File:** `app/user/[id].tsx` (connection handshake UI → "Message" button opens DM).
**File:** `app/dm/[id].tsx` (DM chat screen).

### 2.5 Ghost Channel Cleanup System

Stream Chat channels can become orphaned when their backing Supabase event is deleted or expires. The **Ghost Purge** system (`lib/streamCleanup.ts`) cleans these up:

**Flow:**
1. Query all `messaging` channels the current user belongs to (limit: 30).
2. Extract event IDs from channel IDs (format: `event_{uuid}`).
3. Cross-reference against `events` table — only events with `status = 'active'` pass.
4. Any channel whose event is missing OR expired → `channel.delete()`.
5. Uses `Promise.allSettled` to await all deletions within the same focus cycle.

**Trigger:** Called on `chats.tsx` screen focus via `useFocusEffect`. Safe to call multiple times — short-circuits if Stream isn't connected.

### 2.6 Connection Handshake System

**File:** `lib/social.ts`

State machine for user connections:
```
none → pending_sent (sendConnectionRequest) → accepted (acceptConnectionRequest)
accepted → none (removeConnection)
pending_received → accepted (acceptConnectionRequest)
pending_received → none (removeConnection / ignore)
```

**UI mapping in `app/user/[id].tsx`:**
| Status | Button | Style |
|--------|--------|-------|
| `none` | "Connect" | Blue accent |
| `pending_sent` | "Sent" | Disabled, surface bg, muted text |
| `pending_received` | "Accept" | Green |
| `accepted` | "Message" | Blue accent, opens DM |

**Notification flow:** `sendConnectionRequest` fires a fire-and-forget INSERT into `notifications` table with type `'friend_request'`. `acceptConnectionRequest` inserts type `'request_accepted'`.

### 2.7 Notification Hub

**File:** `app/notifications.tsx`

Real-time notification feed. Fetches with a joined `from_user` profile (via foreign key `notifications_from_user_id_fkey`). Subscribes to `postgres_changes` INSERT events for live delivery.

Types: `friend_request` (shows Accept/Ignore buttons), `request_accepted`, `event_invite`, `system`.

Marks all unread as read on mount (fire-and-forget UPDATE).

### 2.8 Blocked User "Shadow Hiding"

Blocking is implemented at three layers:

1. **Map pins** — `mapStore.blockedUserIds` Set is fetched from `user_blocks` table on mount. `getVisibleEvents()` filters out events where `host_id` is in the blocked set. All rendering code (`clusters`, `handlePinPress`, `handleRegionChangeComplete`, empty state, stacked-pins modal) uses `visibleEvents` instead of raw `events`.

2. **Chat messages** — `hooks/useBlockedUsers.ts` hook fetches blocked IDs. Both `app/event/[id].tsx` and `app/dm/[id].tsx` use a `BlockFilteredMessage` wrapper component passed as `Message={BlockFilteredMessage}` to Stream's `<Channel>`. Messages from blocked users return `null`.

3. **Database** — `user_blocks` table with RLS ensuring users can only see/manage their own blocks.

### 2.9 Supabase Edge Functions (7 deployed)

| Function | Purpose |
|----------|---------|
| `create-event` | Verifies JWT, checks free-user limit (`LIMIT_REACHED` code), inserts event with EWKT location + city, inserts host into `event_participants`, creates Stream channel `event_{id}` |
| `join-event` | Verifies JWT, checks event active + verified_only gate, idempotent `event_participants` insert (handles 23505 race), `addMembers` to Stream; rolls back DB on Stream failure |
| `leave-event` | Removes from `event_participants` + Stream channel |
| `delete-event` | Syncs Stream channel deletion before DB cascade |
| `generate-stream-token` | Verifies JWT, `StreamChat.getInstance(key, secret).createToken(user.id)` |
| `delete-user-account` | Wipes Stream user + Supabase Auth + cascade deletes all DB rows |
| `update-event-location` | Updates event pin coordinates |

### 2.10 Root Layout (`app/_layout.tsx`)

The root layout is the **central nervous system**:

1. **Auth initialization:** `supabase.auth.onAuthStateChange` listener fetches profile, then Stream token, then `connectUser` — all sequentially.
2. **Stream boot:** `connectUser` with 3-attempt exponential backoff (2s, 4s, 8s cap). Then `upsertUser` for strict name/avatar sync.
3. **Stream token refresh:** Also retries with exponential backoff (3 attempts).
4. **Profile change sync:** Reactive `useEffect` on `profile` changes calls `upsertUser` if name or avatar differ from Stream's cached values.
5. **Navigation guard:** Three states:
   - No user → redirect to `/(auth)/`
   - User but `setup_completed === false` → redirect to `/(auth)/setup`
   - User + setup complete → redirect to `/(tabs)/`
6. **OverlayProvider** from `stream-chat-expo` wraps all screens at root level to prevent the "ghost drag handle" bug.
7. **Setup gate:** `{setupComplete && <Stack.Screen name="(tabs)" />}` prevents map screen from mounting (and requesting location permission) before onboarding finishes.

### 2.11 Location Parsing (Two Shapes)

**File:** `lib/mapGeo.ts`

PostGIS `location` columns arrive in two different formats:
1. **RPC/REST:** GeoJSON object `{ type: 'Point', coordinates: [lng, lat] }`
2. **Realtime (postgres_changes):** Raw EWKB hex string `"0101000020E6100000..."`

`dbEventToEvent()` handles both. `parseWKBHex()` decodes EWKB using a pure DataView approach (no Node.js Buffer).

**Jitter:** `eventsToGeoFeatures()` offsets co-located pins by ~2m (`0.00002` degrees) in a spiral pattern so they physically separate at high zoom levels.

---

## 3. THE BATTLE-TESTED ENVIRONMENT

### 3.1 Platform

- **OS:** Windows 11 Pro (10.0.26200)
- **Shell:** PowerShell (but Claude Code runs bash syntax internally)
- **IDE:** IntelliJ-based (`.idea/` directory present)
- **Node/NPM:** Managed via standard PATH

### 3.2 Android Development Setup

- **Android Studio:** Installed with Android SDK
- **Emulator:** Pixel 9 Pro (or physical device via USB debugging)
- **ADB Port:** Must redirect port 8081 for Metro bundler connection

### 3.3 Fixed Ghosts (Environment Bugs Solved)

#### Ghost 1: ADB Port 5562 / 8081 Redirection
When the emulator or physical device can't connect to Metro:
```powershell
adb reverse tcp:8081 tcp:8081
```
If that fails ("device not found"), the ADB server has crashed:
```powershell
adb kill-server
adb start-server
adb reverse tcp:8081 tcp:8081
```

#### Ghost 2: PowerShell Semicolon Syntax
PowerShell uses `;` to chain commands, NOT `&&` like bash. When running sequential commands in PowerShell:
```powershell
adb kill-server; adb start-server; adb reverse tcp:8081 tcp:8081
```
**Claude Code uses bash syntax** (forward slashes, `&&`, `/dev/null`), but if the user runs commands manually in PowerShell, they need semicolons.

#### Ghost 3: White/Blank Map (Software GLES 2.0)
The Android emulator sometimes renders `react-native-maps` as a white rectangle. Root cause: the emulator is using Software GLES instead of hardware GPU rendering.

**Fix:** In Android Studio > AVD Manager > Edit device > Emulated Performance:
- Set Graphics to **"Hardware - GLES 2.0"** (not "Automatic" or "Software")
- Cold boot the emulator after changing this setting

#### Ghost 4: PGRST116 (Single Row Missing)
Supabase `.single()` throws PGRST116 when no row is found. All queries that might return zero rows use `.maybeSingle()` instead. This was fixed in `app/event/[id].tsx` for the event metadata fetch.

#### Ghost 5: Pin Ghosting After DB Wipes
During development, wiping the DB left stale pins on the map because Supercluster kept its internal KD-tree. Fix: `<MapView key={mapKey}>` forces a full remount whenever `mapKey` increments (which happens on every `setEvents`, `addEvent`, `removeEvent`, `setBlockedUserIds` call).

#### Ghost 6: `forceGlobalSignOut` Nuclear Reset
When local state becomes corrupted (e.g., after DB wipes during dev), `lib/supabase.ts` exports `forceGlobalSignOut()` which:
1. Disconnects Stream client
2. Signs out of Supabase
3. Clears all AsyncStorage keys
4. Resets in-memory Zustand stores (`mapStore.setEvents([])`, `locationStore.setCoordinates(null)`)

---

## 4. THE LOGIC BRAIN

### 4.1 What Works (Completed)

- **Auth flow:** Apple Sign In (iOS), Google OAuth (PKCE + expo-web-browser). Deep link scheme: `nomadmeet://auth/callback`.
- **Profile setup:** Two-step onboarding (mandatory: avatar/name/country, optional: bio/IG). RHF + Zod validation.
- **Map screen:** Full-screen interactive map with supercluster clustering, Realtime subscriptions (INSERT/UPDATE/DELETE), client-side radius filtering, re-fetch on 500m movement.
- **Event creation:** Modal with 6 category emoji chips, 4 expiry chips, verified-only toggle. Optimistic `mapStore.addEvent` on success.
- **EventCard bottom sheet:** Glassmorphism blur, host profile, first-5 participant avatars, membership check, spring animation.
- **Group chat:** Stream Chat integration with custom dark theme, meetup banner, participant count from `channel.state.members`, message reactions + replies, Report action on long-press.
- **My Events tab:** 3-step fetch (event_participants -> events -> profiles), sorted by expiry, pull-to-refresh.
- **Profile tab:** Avatar, name, country flag, VerificationBadge (4 states), bio, IG link, Events Hosted count, fade-in animation, haptic on Edit Profile.
- **Edit Profile:** display_name, bio, instagram_handle inputs + chip selectors for travel_styles (10), languages (16), visited_countries (57), persona_tags (12). BlurView glassmorphism header.
- **Preview Profile:** Read-only public view with tag chips and Gallery component.
- **Settings:** Hub with Contact Us / Privacy / Terms legal screens. Delete Account with type-DELETE confirmation.
- **Stream strict sync:** `upsertUser` on boot + reactive `useEffect` on profile changes.
- **Stream token retry:** Exponential backoff (3 attempts) on both `fetchStreamToken` and `connectUser`.
- **Ghost channel purge:** Cross-references Stream channels with `events` table. Filters by `status === 'active'`. Uses `Promise.allSettled`.
- **Connection handshake:** Full state machine (none/pending_sent/pending_received/accepted) with UI in `user/[id].tsx`.
- **Notification hub:** Real-time feed with Supabase Realtime subscription, Accept/Ignore buttons for friend requests.
- **Blocked user filtering:** Map pins hidden via `getVisibleEvents()`, chat messages hidden via `BlockFilteredMessage` wrapper.
- **DM system:** Deterministic channel IDs, lightweight chat screen at `app/dm/[id].tsx`.
- **Sonar pulse:** Custom user location marker with continuous scale+opacity animation.
- **Reanimated Gallery:** Spring-based pan gestures with haptic feedback on swipe.
- **Android KAV:** `behavior="height"` instead of `"padding"` to prevent MessageInput from being pushed off-screen.
- **Chat theming:** Custom `STREAM_THEME` in `constants/theme.ts` with styled MessageInput (rounded corners, accent send button).

### 4.2 What's Pending / TODO

- **Custom MessageInput:** Photo Library, Camera, and Stream Poll attachment options (placeholder — stock MessageInput currently used).
- **RevenueCat integration:** "Restore Purchases" is a placeholder. Verified Traveler badge payment flow not wired.
- **Push notifications:** `expo-notifications` not yet implemented. Push tokens stored in profiles but not used.
- **Event expiry cascade:** `pg_cron` + `process-expiring-events` Edge Function not yet deployed.
- **Host "Reopen Chat":** Post-expiry flow not implemented.
- **Hard deletion:** 7-day cleanup cron not deployed.
- **`hostVerified` on pins:** Hardcoded `false` — needs RPC join with profiles to populate verification status.
- **List View toggle:** Map screen only has map view. List view (vertical scroll sorted by expiry) not built.
- **Offline state:** No offline banner or cached state handling yet.
- **Blocked user real-time refresh:** `useBlockedUsers` hook only fetches on mount, doesn't subscribe to changes.
- **DB migration needed:** `persona_tags TEXT[] DEFAULT '{}'` column (may already be applied — verify).
- **`OverlayProvider` concern:** Currently at root layout level (correct). Was previously duplicated in chat screens — ensure it's only at root.

### 4.3 Connection Acceptance (Detailed Status)

The connection accept flow works in code (`lib/social.ts` > `acceptConnectionRequest`) but relies on:
1. A `connections` table existing in the DB (migration: `20260306_connections_and_reports.sql`)
2. A `notifications` table existing in the DB (migration: `20260306_notifications_and_blocks.sql`)
3. A `user_blocks` table existing in the DB (same migration)

**These SQL migrations have been written but may not yet be executed against the live Supabase instance.** The user must run them manually via Supabase Studio SQL Editor.

---

## 5. TESTING PROTOCOL

### 5.1 Terminal Commands (The "Sovereign" Sequence)

**Start fresh (clean cache):**
```powershell
npx expo start -c
```

**Start with dev client (after native build):**
```powershell
npx expo start --dev-client -c
```

**Build and run on Android:**
```powershell
npx expo run:android
```

**Nuclear restart (when everything breaks):**
```powershell
# Kill any lingering node processes
taskkill /f /im node.exe

# Reset ADB
adb kill-server
adb start-server
adb reverse tcp:8081 tcp:8081

# Start Expo with clean cache
npx expo start -c
```

**ADB handshake (when app can't connect to Metro):**
```powershell
adb reverse tcp:8081 tcp:8081
```

### 5.2 Verification Approach

There is no automated test suite. Testing is manual:
1. Run the app on the Android emulator (Pixel 9 Pro) or physical device
2. Verify flows visually — auth, map rendering, pin creation, chat, profile
3. Check Metro terminal logs for `[Map]`, `[Stream]`, `[EventChat]`, `[GhostPurge]` prefixed console output
4. Supabase Studio for DB state verification

### 5.3 Mock Testing Mode

`app/event/[id].tsx` has a built-in mock mode activated when `eventId === "test-paris"`. It:
- Bypasses all Supabase fetching
- Uses hardcoded event state (title, participant count, meetup point)
- Connects to a `paris-sandbox` public Stream channel
- Provides 4 fake members for the members modal

---

## 6. FILE MAP

### Core Infrastructure
| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Supabase client (AsyncStorage session) + `forceGlobalSignOut()` nuclear reset |
| `lib/streamClient.ts` | `StreamChat.getInstance()` singleton. Never disconnect on screen unmounts. |
| `lib/streamCleanup.ts` | Ghost channel purge (cross-reference Stream channels with DB events) |
| `lib/social.ts` | Connection handshake helpers: check/send/accept/remove |
| `lib/mapGeo.ts` | Haversine, EWKB parser, `dbEventToEvent()`, supercluster feature builder with jitter |
| `lib/uploadAvatar.ts` | Profile photo upload to Supabase Storage |
| `hooks/useBlockedUsers.ts` | Hook returning `Set<string>` of blocked user IDs |
| `types/index.ts` | All shared types: Profile, Event, DBEvent, EventCategory, EventStatus, Country |
| `constants/theme.ts` | Colors, Spacing, Radius, Shadows, STREAM_THEME |
| `constants/countries.ts` | 57-country curated list with ISO codes + emoji flags |
| `constants/categories.ts` | `CATEGORY_EMOJI` map |

### Stores
| File | Purpose |
|------|---------|
| `stores/authStore.ts` | Persisted: user, profile, streamToken. Transient: isInitialized |
| `stores/locationStore.ts` | Not persisted: coordinates, permissionStatus, city |
| `stores/mapStore.ts` | Not persisted: events[], filters, blockedUserIds, mapKey, getVisibleEvents() |

### Screens (Expo Router file-based)
| File | Purpose |
|------|---------|
| `app/_layout.tsx` | Root: auth init, Stream boot, navigation guard, OverlayProvider |
| `app/(auth)/splash.tsx` | 1.5s splash |
| `app/(auth)/index.tsx` | Login: Apple (iOS) + Google (PKCE) |
| `app/(auth)/setup.tsx` | Two-step profile setup (RHF + Zod) |
| `app/(tabs)/_layout.tsx` | Bottom tab navigator: Map / My Events / Profile |
| `app/(tabs)/index.tsx` | Map screen: location, pins, clusters, Realtime, blocked user filtering |
| `app/(tabs)/my-events.tsx` | 3-step fetch, sorted by expiry, pull-to-refresh |
| `app/(tabs)/chats.tsx` | Channel list with ghost channel purge on focus |
| `app/(tabs)/profile.tsx` | Own profile: avatar, stats, fade-in, haptics |
| `app/event/create.tsx` | Modal: category chips, expiry chips, verified-only toggle |
| `app/event/[id].tsx` | Group chat: Stream Chat, meetup banner, join/leave/delete, blocked message filter |
| `app/event/edit-location.tsx` | Edit pin coordinates (host only) |
| `app/dm/[id].tsx` | Private DM chat with blocked message filter |
| `app/user/[id].tsx` | Other user profile: connection state machine + Message button |
| `app/notifications.tsx` | Real-time notification hub with Accept/Ignore |
| `app/profile/edit.tsx` | Edit profile: inputs + chip selectors + glassmorphism header |
| `app/profile/preview.tsx` | Read-only public profile view + Gallery |
| `app/profile/settings.tsx` | Settings hub |
| `app/profile/contact.tsx` | Contact Us screen |
| `app/profile/privacy.tsx` | Privacy Policy screen |
| `app/profile/terms.tsx` | Terms of Service screen |

### Components
| File | Purpose |
|------|---------|
| `components/map/EventCard.tsx` | Always-mounted sheet, spring animation, glassmorphism blur |
| `components/auth/CountryPicker.tsx` | Modal + FlatList + search filter |
| `components/profile/Gallery.tsx` | Reanimated pan gesture gallery with haptics |
| `components/chat/MeetupBanner.tsx` | Fixed banner below chat header |
| `components/chat/OptionsModal.tsx` | "..." menu modal |
| `components/chat/MeetupModal.tsx` | Set meetup point input modal |
| `components/chat/DeleteConfirmModal.tsx` | Delete event confirmation |
| `components/chat/MembersModal.tsx` | Tappable member directory |

### Styles
| File | Purpose |
|------|---------|
| `styles/mapScreenStyles.ts` | Map screen + sonar pulse + cluster markers |
| `styles/eventCardStyles.ts` | EventCard sheet + glassmorphism |
| `styles/eventChatStyles.ts` | Chat screen + Stream theme |
| `styles/createEventStyles.ts` | Event creation modal |

### SQL Migrations
| File | Purpose |
|------|---------|
| `supabase/migrations/20260306_connections_and_reports.sql` | `connections` + `reports` tables with RLS |
| `supabase/migrations/20260306_notifications_and_blocks.sql` | `notifications` + `user_blocks` tables with RLS |

### Edge Functions (Deno)
| File | Purpose |
|------|---------|
| `supabase/functions/create-event/index.ts` | DB insert + Stream channel creation |
| `supabase/functions/join-event/index.ts` | Idempotent join + Stream addMembers |
| `supabase/functions/leave-event/index.ts` | DB remove + Stream removeMembers |
| `supabase/functions/delete-event/index.ts` | Stream delete + DB cascade |
| `supabase/functions/generate-stream-token/index.ts` | JWT verify + Stream token |
| `supabase/functions/delete-user-account/index.ts` | Full wipe: Stream + Auth + DB |
| `supabase/functions/update-event-location/index.ts` | Update pin coordinates |

---

## 7. HARD-WON LESSONS

### Environment Variables (Exact Names)
```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY (Edge Functions only)
EXPO_PUBLIC_STREAM_API_KEY
STREAM_SECRET_KEY (Edge Functions only)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
EXPO_PUBLIC_REVENUECAT_IOS_KEY
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
```

### Critical Patterns to Never Break

1. **Edge Functions for destructive actions.** Client never calls DELETE on events. Always goes through Edge Function to sync Stream.
2. **`participant_count` is DB-trigger-only.** Client never writes it.
3. **`setup_completed` is the onboarding gate.** Never check string fields.
4. **`getVisibleEvents()` for all rendering.** Never use raw `events` from mapStore for display.
5. **`upsertUser` not `partialUpdateUser`** for Stream user sync. Partial update can silently fail.
6. **`.maybeSingle()` not `.single()`** for queries that might return zero rows.
7. **`key={mapKey}` on MapView.** Forces remount when event data changes.
8. **OverlayProvider at root level only.** Never nest inside chat screens.
9. **Android KAV: `behavior="height"`**, not `"padding"`. Prevents MessageInput from being pushed off-screen.
10. **Exponential backoff** on all Stream network calls (token fetch, connectUser).

### The `app.config.js` Setup

- Scheme: `travelapp`
- Google Maps API key read from `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` env var
- Android: `softwareKeyboardLayoutMode: "resize"`, `predictiveBackGestureEnabled: false`
- iOS: `usesNonExemptEncryption: false`
- Plugins: `expo-router`, `expo-web-browser`, `expo-image`, `expo-location`

### Project Documentation Files

Detailed architecture docs live in `.claude/docs/`:
- `tech_stack.md` — Exact libraries and constraints
- `data_schema.md` — SQL tables, triggers, RPC functions
- `user_flow.md` — Screen-by-screen user journeys
- `realtime_architecture.md` — Supabase Realtime vs Stream.io separation
- `security_and_rls.md` — RLS policies for every table
- `copy_guidelines.md` — Anti-cliche copy rules

---

*End of Master Context Document*
