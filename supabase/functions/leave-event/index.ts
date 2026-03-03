// Supabase Edge Function: leave-event
// Trigger: participant taps "Leave Event" in the ••• options sheet
// Responsibilities:
//   1. Verify caller JWT
//   2. Guard: host cannot leave (they must delete instead)
//   3. Idempotency: no-op if caller is not a participant
//   4. Delete caller from event_participants
//      (DB trigger auto-decrements events.participant_count)
//   5. Remove caller from the Stream channel (stops push notifications)
//   6. Rollback DB delete if Stream removal fails — keeps state consistent
//   7. Return { success: true, already_left: boolean }

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

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // ── 1. Verify JWT ──────────────────────────────────────────────────────────
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

  // ── 2. Parse & validate body ───────────────────────────────────────────────
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

  // ── 3. Fetch event — need host_id ──────────────────────────────────────────
  const { data: event, error: eventError } = await serviceClient
    .from('events')
    .select('id, host_id')
    .eq('id', event_id)
    .single();

  if (eventError || !event) {
    return jsonResponse({ error: 'Event not found' }, 404);
  }

  // ── 4. Guard: host cannot leave — they must delete the event ───────────────
  if (event.host_id === user.id) {
    return jsonResponse(
      {
        code: 'HOST_CANNOT_LEAVE',
        error: 'As the host, you cannot leave your own event. Delete it instead.',
      },
      400,
    );
  }

  // ── 5. Idempotency: if already not a participant, return early ─────────────
  const { data: participantRow } = await serviceClient
    .from('event_participants')
    .select('user_id')
    .eq('event_id', event_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!participantRow) {
    return jsonResponse({ success: true, already_left: true });
  }

  // ── 6. Delete from event_participants ─────────────────────────────────────
  // The DB trigger on event_participants DELETE decrements events.participant_count
  // automatically — no manual update needed here.
  const { error: deleteError } = await serviceClient
    .from('event_participants')
    .delete()
    .eq('event_id', event_id)
    .eq('user_id', user.id);

  if (deleteError) {
    console.error('[leave-event] participant delete error:', deleteError.message);
    return jsonResponse({ error: 'Failed to leave event' }, 500);
  }

  // ── 7. Remove from Stream channel — with DB rollback on failure ────────────
  try {
    const streamServer = StreamChat.getInstance(STREAM_API_KEY, STREAM_SECRET_KEY);
    const channel = streamServer.channel('messaging', `event_${event_id}`);
    await channel.removeMembers([user.id]);
  } catch (streamErr) {
    // FATAL: roll back the DB delete so participation state stays consistent.
    // Re-inserting triggers the increment trigger, restoring participant_count.
    console.error('[leave-event] Fatal: Stream removeMembers failed:', streamErr);
    await serviceClient
      .from('event_participants')
      .insert({ event_id, user_id: user.id });
    return jsonResponse(
      { error: 'Failed to leave the chat room. Please try again.' },
      500,
    );
  }

  return jsonResponse({ success: true, already_left: false });
});
