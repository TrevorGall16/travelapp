

```markdown
# SECURITY_AND_RLS.md

**For:** Builder AI  
**Project:** Solo Travel Social App (NomadMeet)  
**Purpose:** Define the exact Row-Level Security (RLS) policies for PostgreSQL. The Builder AI must execute this SQL to prevent client-side data manipulation and unauthorized access.

---

## 1. CORE PRINCIPLES

1. **Enable RLS Everywhere:** Every single table must have RLS enabled.
2. **Client vs. Server:** The client app (using the `anon` key) is heavily restricted by these policies. Supabase Edge Functions (using the `SERVICE_ROLE_KEY`) bypass these policies entirely to perform administrative actions (like event expiry and account deletion).
3. **No Soft Deletes by Users:** Users cannot delete their own events directly from the client. They must call the `delete-event` Edge Function to ensure the Stream.io channel is also destroyed securely.

---

## 2. ENABLE RLS

The Builder AI must run this first to lock down the database.

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

```

---

## 3. PROFILES POLICIES

**Rules:** - Anyone can read any profile (needed for the map and chat).

* Users can only update their own profile.
* Users **cannot** update their own `verification_status` or `events_hosted_count` (these are handled by Admin/Edge Functions).

```sql
-- Read: Public
CREATE POLICY "Profiles are visible to everyone" 
ON profiles FOR SELECT USING (true);

-- Insert: Handled by Supabase Auth Trigger (Not client-side)
-- Users cannot manually insert rows into profiles.

-- Update: Self only, restricted columns
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  -- Prevent users from spoofing verification status
  AND verification_status = OLD.verification_status 
  AND events_hosted_count = OLD.events_hosted_count
);

```

---

## 4. EVENTS POLICIES

**Rules:**

* Anyone can read active events.
* Users can insert events (Edge function handles Stream creation).
* Users can only update their own events (e.g., description, extending expiry).
* Users **cannot** delete events directly (must use Edge Function).

```sql
-- Read: Public (Filtered by active status)
CREATE POLICY "Active events are visible to everyone" 
ON events FOR SELECT USING (status = 'active');

-- Insert: Authenticated users only
CREATE POLICY "Authenticated users can create events" 
ON events FOR INSERT WITH CHECK (auth.uid() = host_id);

-- Update: Host only
CREATE POLICY "Hosts can update their own events" 
ON events FOR UPDATE USING (auth.uid() = host_id)
WITH CHECK (auth.uid() = host_id);

-- Delete: BLOCKED
-- Deletions must go through the `delete-event` Edge Function to sync with Stream.io.

```

---

## 5. EVENT PARTICIPANTS POLICIES

**Rules:**

* Anyone can read who is in an event.
* Users can only join (insert) themselves.
* Users can only leave (delete) themselves.
* The host can remove (delete) other participants.

```sql
-- Read: Public
CREATE POLICY "Participant lists are visible to everyone" 
ON event_participants FOR SELECT USING (true);

-- Insert: Users can only add themselves
CREATE POLICY "Users can join events" 
ON event_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Delete: Users can leave, or Host can remove them
CREATE POLICY "Users can leave or hosts can remove" 
ON event_participants FOR DELETE USING (
  auth.uid() = user_id 
  OR 
  auth.uid() = (SELECT host_id FROM events WHERE id = event_participants.event_id)
);

```

---

## 6. MODERATION POLICIES (REPORTS & BLOCKS)

**Rules for Reports:**

* Users can only insert reports.
* Users cannot read, update, or delete reports (Admin only via Studio).

```sql
-- Insert: Authenticated users only
CREATE POLICY "Users can submit reports" 
ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Read/Update/Delete: BLOCKED for clients.

```

**Rules for Blocks:**

* Users can only see their own blocks.
* Users can only insert/delete their own blocks.

```sql
-- Read: Self only
CREATE POLICY "Users can see own blocks" 
ON blocks FOR SELECT USING (auth.uid() = blocker_id);

-- Insert: Self only
CREATE POLICY "Users can block others" 
ON blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- Delete: Self only (Unblock)
CREATE POLICY "Users can unblock" 
ON blocks FOR DELETE USING (auth.uid() = blocker_id);

```

---

## 7. AVOIDING BLOCKED USER DATA

To ensure blocked users do not appear on the map or in Explore feeds, the Builder AI must append this logic to client-side RPC calls or queries, or handle it via Zustand filtering using the user's downloaded block list.

*Constraint:* The PostGIS RPC function `get_events_within_radius` should ideally be modified by the Builder AI to exclude events where the `host_id` is in the user's block list.

---

*End of Security and RLS Document*

```
