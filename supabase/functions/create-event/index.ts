// Supabase Edge Function: create-event
// Trigger: Client call from app/event/create.tsx
// Responsibilities:
//   1. Verify caller JWT
//   2. Enforce free-user active event limit (1 active)
//   3. Insert event row with PostGIS location + city column
//   4. Insert host into event_participants (DB trigger auto-increments participant_count)
//   5. Create Stream.io channel and add host as member
//   6. Return the created event

import { createClient } from 'npm:@supabase/supabase-js@2';
import { StreamChat } from 'npm:stream-chat@8';

// ─── Env ──────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// EXPO_PUBLIC_ prefix is used here to match the env var names documented in tech_stack.md
const STREAM_API_KEY = Deno.env.get('EXPO_PUBLIC_STREAM_API_KEY')!;
const STREAM_SECRET_KEY = Deno.env.get('STREAM_SECRET_KEY')!;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestBody {
  title: string;
  category: string;
  description: string | null;
  expires_at: string; // ISO string computed client-side from user's local timezone
  latitude: number;
  longitude: number;
  city: string | null;
  verified_only: boolean;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // ── 1. Verify JWT ───────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing authorization header' }, 401);
  }
  const jwt = authHeader.replace('Bearer ', '');

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: authError,
  } = await serviceClient.auth.getUser(jwt);

  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // ── 2. Parse & validate body ────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { title, category, description, expires_at, latitude, longitude, city, verified_only } = body;

  if (
    typeof title !== 'string' || title.trim().length < 10 || title.trim().length > 60 ||
    typeof category !== 'string' ||
    typeof expires_at !== 'string' ||
    typeof latitude !== 'number' || !isFinite(latitude) ||
    typeof longitude !== 'number' || !isFinite(longitude)
  ) {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  const expiresAtDate = new Date(expires_at);
  if (isNaN(expiresAtDate.getTime())) {
    return jsonResponse({ error: 'Invalid expires_at date' }, 400);
  }

  // Validate expiry is in a sane window: between 1 hour and 26 hours from now
  const now = Date.now();
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const diffMs = expiresAtDate.getTime() - now;
  if (diffMs < ONE_HOUR_MS || diffMs > 26 * ONE_HOUR_MS) {
    return jsonResponse({ error: 'expires_at must be between 1 and 26 hours from now' }, 400);
  }

  // ── 3. Check free-user active event limit ────────────────────────────────
  // Fetch user's verification status and active event count in parallel
  const [profileResult, activeEventCountResult] = await Promise.all([
    serviceClient
      .from('profiles')
      .select('verification_status')
      .eq('id', user.id)
      .single(),
    serviceClient
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('host_id', user.id)
      .eq('status', 'active'),
  ]);

  if (profileResult.error) {
    console.error('[create-event] profile fetch error:', profileResult.error.message);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }

  const isVerified = profileResult.data?.verification_status === 'verified';
  const activeCount = activeEventCountResult.count ?? 0;

  if (!isVerified && activeCount >= 1) {
    return jsonResponse({ code: 'LIMIT_REACHED', error: 'Free users can only have 1 active event' }, 200);
  }

  // ── 4. Insert event into DB ──────────────────────────────────────────────
  // NOTE: participant_count is set to 0 here so the DB trigger correctly
  // increments it to 1 when the host is inserted into event_participants below.
  // The schema default of 1 would cause double-counting — this explicit 0 is intentional.
  const { data: event, error: insertError } = await serviceClient
    .from('events')
    .insert({
      host_id: user.id,
      title: title.trim(),
      description: description ?? null,
      category,
      // PostgREST accepts EWKT strings and casts them to geometry automatically
      location: `SRID=4326;POINT(${longitude} ${latitude})`,
      status: 'active',
      verified_only: verified_only ?? false,
      participant_count: 0,
      expires_at: expiresAtDate.toISOString(),
      city: city ?? null,
    })
    .select(
      'id, host_id, title, description, category, status, verified_only, participant_count, expires_at, city, maps_taps, arrivals, post_event_messages, created_at',
    )
    .single();

  if (insertError || !event) {
    console.error('[create-event] event insert error:', insertError?.message);
    return jsonResponse({ error: 'Failed to create event' }, 500);
  }

// ── 5. Insert host into event_participants ───────────────────────────────
  const { error: participantError } = await serviceClient
    .from('event_participants')
    .insert({ event_id: event.id, user_id: user.id });

  if (participantError) {
    // FATAL: If we can't add the host, delete the event and abort.
    console.error('[create-event] Fatal participant insert error:', participantError.message);
    await serviceClient.from('events').delete().eq('id', event.id);
    return jsonResponse({ error: 'Failed to join own event' }, 500);
  }

  // ── 6. Create Stream.io channel ──────────────────────────────────────────
  try {
    const streamClient = StreamChat.getInstance(STREAM_API_KEY, STREAM_SECRET_KEY);
    const channelId = `event_${event.id}`;

    const channel = streamClient.channel('messaging', channelId, {
      name: title.trim(),
      created_by_id: user.id,
      members: [user.id],
    });

    await channel.create();
  } catch (streamErr) {
    // FATAL: If the chat channel fails, the app breaks. Delete the DB row and abort.
    console.error('[create-event] Fatal Stream channel creation failed:', streamErr);
    await serviceClient.from('events').delete().eq('id', event.id);
    return jsonResponse({ error: 'Failed to initialize chat room' }, 500);
  }

  return jsonResponse({ event });
});