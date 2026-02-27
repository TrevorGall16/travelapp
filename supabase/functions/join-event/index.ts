// Supabase Edge Function: join-event
// Trigger: Client call from EventCard "Join Event" tap
// Responsibilities:
//   1. Verify caller JWT
//   2. Validate event exists, is active, and the user meets verified_only requirement
//   3. Idempotently insert the user into event_participants
//      (DB trigger auto-increments events.participant_count)
//   4. Add the user as a Stream channel member
//   5. Return { success: true, already_member: boolean }

import { createClient } from 'npm:@supabase/supabase-js@2';
import { StreamChat } from 'npm:stream-chat@8';

// ─── Env ──────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STREAM_API_KEY = Deno.env.get('EXPO_PUBLIC_STREAM_API_KEY')!;
const STREAM_SECRET_KEY = Deno.env.get('STREAM_SECRET_KEY')!;

// ─── Helper ───────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // ── 1. Verify JWT ─────────────────────────────────────────────────────────
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

  // ── 2. Parse & validate body ──────────────────────────────────────────────
  let body: { event_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { event_id } = body;
  if (typeof event_id !== 'string' || event_id.trim() === '') {
    return jsonResponse({ error: 'event_id is required' }, 400);
  }

  // ── 3. Fetch the event ────────────────────────────────────────────────────
  const { data: event, error: eventError } = await serviceClient
    .from('events')
    .select('id, status, verified_only, host_id')
    .eq('id', event_id)
    .single();

  if (eventError || !event) {
    return jsonResponse({ error: 'Event not found' }, 404);
  }

  if (event.status !== 'active') {
    return jsonResponse(
      { code: 'EVENT_EXPIRED', error: 'This event has already expired.' },
      200,
    );
  }

  // ── 4. Enforce verified_only gate ─────────────────────────────────────────
  if (event.verified_only) {
    const { data: callerProfile, error: profileError } = await serviceClient
      .from('profiles')
      .select('verification_status')
      .eq('id', user.id)
      .single();

    if (profileError || callerProfile?.verification_status !== 'verified') {
      return jsonResponse(
        {
          code: 'VERIFIED_ONLY',
          error: 'This event is only open to verified travelers.',
        },
        200,
      );
    }
  }

  // ── 5. Idempotent participant insert ──────────────────────────────────────
  // Check whether the user is already a participant
  const { data: existingRow } = await serviceClient
    .from('event_participants')
    .select('user_id')
    .eq('event_id', event_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingRow) {
    // Already a member — no DB write needed, but still ensure Stream membership
    try {
      const streamServer = StreamChat.getInstance(STREAM_API_KEY, STREAM_SECRET_KEY);
      const channel = streamServer.channel('messaging', `event_${event_id}`);
      await channel.addMembers([user.id]);
    } catch (streamErr) {
      // Non-fatal: user may already be a Stream member; log and continue
      console.warn('[join-event] Stream addMembers (already joined):', streamErr);
    }
    return jsonResponse({ success: true, already_member: true });
  }

  // Insert into event_participants — DB trigger increments participant_count
  const { error: insertError } = await serviceClient
    .from('event_participants')
    .insert({ event_id, user_id: user.id });

  if (insertError) {
    // Handle race condition: another request may have inserted simultaneously
    if (insertError.code === '23505') {
      // Unique constraint violation — user was inserted by a concurrent request
      return jsonResponse({ success: true, already_member: true });
    }
    console.error('[join-event] participant insert error:', insertError.message);
    return jsonResponse({ error: 'Failed to join event' }, 500);
  }

  // ── 6. Add user as a Stream channel member ────────────────────────────────
  try {
    const streamServer = StreamChat.getInstance(STREAM_API_KEY, STREAM_SECRET_KEY);
    const channel = streamServer.channel('messaging', `event_${event_id}`);
    await channel.addMembers([user.id]);
  } catch (streamErr) {
    // FATAL: chat membership is the core value of joining. Roll back the DB row.
    console.error('[join-event] Fatal: Stream addMembers failed:', streamErr);
    await serviceClient
      .from('event_participants')
      .delete()
      .eq('event_id', event_id)
      .eq('user_id', user.id);
    return jsonResponse(
      { error: 'Failed to join the chat room. Please try again.' },
      500,
    );
  }

  return jsonResponse({ success: true, already_member: false });
});
