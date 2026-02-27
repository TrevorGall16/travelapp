
# REALTIME_ARCHITECTURE.md

**For:** Builder AI  
**Project:** Solo Travel Social App (NomadMeet - Working Title) 
**Purpose:** Define every real-time infrastructure decision so the Builder AI never invents its own approach. This document governs all live data — map updates, chat, polls, presence, notifications, and the Model B expiry cascade.

---

## CORE PRINCIPLE
There are two real-time providers in this app. Their responsibilities are strictly separated and must never overlap:

| Provider | Owns | Does NOT own |
|---|---|---|
| **Supabase Realtime** | Live map pins, event status changes, verified badge updates | Chat messages, polls, meetup point coordinates |
| **Stream.io** | All chat messages, meetup point coordinates, polls, participant presence | Map state, event expiry |

If something is chat-related, it lives in Stream. If something is map or event-related, it lives in Supabase Realtime. Never mix them.

---

## 1. SUPABASE REALTIME — MAP & EVENTS

### 1.1 What it handles
- New event pin appears on map when another user creates an event.
- Event pin disappears from map when event expires or is deleted.
- Participant count on event pin updates when someone joins.
- Verified badge appears on user profile when admin approves.

### 1.2 Database Triggers (Participant Counts)
Supabase Realtime uses Postgres Change Data Capture (CDC). 
**Critical Database Rule:** The Builder AI must create a Postgres Trigger that automatically increments/decrements a hard `participant_count` integer column on the `events` table whenever a user joins/leaves the `event_participants` table. Do not rely on client-side counting.

### 1.3 Radius Filtering & Subscriptions
Supabase Realtime CDC does NOT support PostGIS `ST_DWithin` spatial filtering on websocket subscriptions. 

1. **Initial Load:** The client uses a PostGIS RPC function to fetch events within a 5km radius.
2. **Realtime Updates:** The Builder AI must subscribe to the `events` table using an `eq` filter on the user's current `city` string (auto-detected on pin drop) to prevent global data leaks.

**Client-Side Radius Maintenance:**
- The Realtime subscription receives all events in the city; the client must filter out pins beyond the 5km radius using stored user coordinates.
- When the user moves more than 500m, re-fetch events via RPC for the new location and reset the subscription.

---

## 2. STREAM.IO — CHAT, MEETUP POINT, & POLLS

### 2.1 Channel Structure
Each event maps to exactly one Stream channel:
```text
Channel type: messaging
Channel ID: event_{supabase_event_id}

```

**Creation:** Server-side via Supabase Edge Function (`create-event`). Never create channels client-side.

### 2.2 Meetup Point (Single Source of Truth)

The meetup point is stored as Stream channel `custom_data`, NOT in Supabase.

**Setting meetup point (Host action only):**

```typescript
await channel.updatePartial({
  set: {
    meetup_point: {
      latitude: 13.7563,
      longitude: 100.5018,
      label: 'In front of the 7-Eleven'
    }
  }
})

```

Listen for `channel.updated` event in the chat screen to instantly update the Meetup Banner for all participants. Rate limit updates to 3 per hour.

### 2.3 Consensus & Voting (Polls)

Do not build custom database tables for voting. If the host is inactive, users achieve consensus via Stream Polls.

* User taps `📎` attachment icon -> selects "Poll".
* Stream.io natively handles poll creation, option rendering, and vote tallying directly in the chat feed.

### 2.4 Chat Media

Images only. Max 5MB. Compressed client-side. Stored by Stream.io natively. NO video support in V1.

---

## 3. LOCATION HANDLING

### 3.1 Library & Rules

Use `expo-location` exclusively.

* **Foreground Only:** Update every 30 seconds OR when user moves more than 100 meters.
* **No Background Tracking:** V1 does not require background location.
* **Privacy Rule:** Exact user coordinates are NEVER saved to the database. We do not track users, only event pins.

---

## 4. EVENT EXPIRY (MODEL B) & RETENTION

### 4.1 Server-Side Expiry Engine

Event expiry is handled server-side via `pg_cron` combined with `pg_net` calling an Edge Function directly every 5 minutes.

```sql
SELECT cron.schedule(
  'process-expiring-events',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url:='https://[PROJECT_REF].supabase.co/functions/v1/process-expiring-events',
      headers:='{"Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb
    );
  $$
);

```

### 4.2 Expiry Cascade (Model B)

The `process-expiring-events` Edge Function queries all events where `expires_at < NOW()` and `status = 'active'`. For each expired event:

1. Updates DB status to `expired` (Realtime CDC instantly removes pins from maps).
2. Calls Stream API to freeze the channel (`frozen: true`), making it read-only.
3. Locks the Meetup Point (cannot be updated).

### 4.3 Host Reopen

Host taps "Reopen Chat". Calls `reopen-event` Edge Function:

1. Updates Stream channel: `frozen: false`.
2. Previous participants can chat again. No new joins permitted.

### 4.4 Hard Deletion (7-Day Retention)

A separate daily `pg_cron` job triggers `cleanup-expired-events` Edge Function. It queries all events where `expires_at < NOW() - INTERVAL '7 days'`.

* Deletes Stream channel entirely.
* Cascade deletes event row and participant rows from Supabase.

---

## 5. PUSH NOTIFICATIONS

Use **Expo Push Notification Service (EPNS)** exclusively.

* **Storage:** Store `push_token` in the `profiles` table. Re-register on every app launch.
* **Execution:** Sent strictly from Supabase Edge Functions. Never client-side.
* **Deep Linking:** Handled via `Notifications.addNotificationResponseReceivedListener` -> Expo Router.

---

## 6. ZUSTAND STATE MANAGEMENT

Strictly limit global state to these 3 stores. Component state handles everything else.

1. **`authStore`**: `user`, `profile`, `streamToken`.
2. **`locationStore`**: `coordinates`, `permissionStatus`.
3. **`mapStore`**: `events`, `filters` (radius, category sort).

---

## 7. SUPABASE EDGE FUNCTIONS INVENTORY

The Builder AI must create these exact Deno Edge Functions.

| Function Name | Trigger | Purpose |
| --- | --- | --- |
| `create-event` | Client call | Creates event in DB, creates Stream channel, adds host |
| `join-event` / `leave-event` | Client call | Syncs participant status between DB and Stream channel |
| `generate-stream-token` | Client call (login) | Generates signed Stream token using `STREAM_SECRET_KEY` |
| `process-expiring-events` | pg_cron (5 min) | Batches expired events, updates DB, freezes Stream |
| `reopen-event` | Client call (Host) | Unfreezes Stream channel for post-event mode |
| `cleanup-expired-events` | pg_cron (Daily) | Hard deletes 7-day-old expired events + Stream channels |
| `verify-traveler-purchase` | Client call (IAP) | Verifies RevenueCat receipt, updates profile |
| `delete-user-account` | Client call | Wipes Stream user, auth user, profile, cascade deletes events |

---

*End of Real-Time Architecture Document*

```
