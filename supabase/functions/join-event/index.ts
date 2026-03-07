// Supabase Edge Function: join-event
import { createClient } from 'npm:@supabase/supabase-js@2';
import { StreamChat } from 'npm:stream-chat@8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const STREAM_API_KEY = Deno.env.get('EXPO_PUBLIC_STREAM_API_KEY')!;
    const STREAM_SECRET_KEY = Deno.env.get('STREAM_SECRET_KEY')!;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 2. Verify caller JWT
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { event_id } = await req.json();

    // 3. Fetch Event
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('status, verified_only')
      .eq('id', event_id)
      .single();

    if (eventError || !event) throw new Error('Event not found');
    if (event.status !== 'active') {
      return new Response(
        JSON.stringify({ code: 'EVENT_EXPIRED', error: 'This event has already expired.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3b. Enforce verified_only gate
    if (event.verified_only) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('verification_status')
        .eq('id', user.id)
        .single();
      if (profile?.verification_status !== 'verified') {
        return new Response(
          JSON.stringify({ code: 'VERIFIED_ONLY', error: 'This event is for verified travelers only.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // 4. Insert Participant (Idempotent)
    // Track whether we actually inserted a new row — determines whether we need
    // to roll back on a downstream Stream failure.
    const { error: insertError } = await supabaseAdmin
      .from('event_participants')
      .insert({ event_id, user_id: user.id });

    // 23505 = unique violation → user is already in the table (idempotent skip).
    // didInsert is false in this case: no new DB row, so no rollback is needed.
    const didInsert = !insertError;
    if (insertError && insertError.code !== '23505') throw insertError;

    // ── Helper: undo the DB insert if something downstream fails ──────────────
    const rollbackInsert = async () => {
      if (!didInsert) return; // nothing to undo if we didn't insert
      const { error: rbErr } = await supabaseAdmin
        .from('event_participants')
        .delete()
        .eq('event_id', event_id)
        .eq('user_id', user.id);
      if (rbErr) {
        console.error('[join-event] ROLLBACK FAILED — DB may be inconsistent:', rbErr.message);
      }
    };

    // 5. Stream Chat Sync
    const streamServer = StreamChat.getInstance(STREAM_API_KEY, STREAM_SECRET_KEY);

    // Upsert the Stream user BEFORE any channel operations — prevents
    // "user not found" errors (codes 4/17) when the client hasn't called
    // connectUser yet or the Stream user was purged.
    const { data: joinerProfile } = await supabaseAdmin
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single();

    await streamServer.upsertUser({
      id: user.id,
      name: joinerProfile?.display_name ?? user.email ?? 'Traveler',
      image: joinerProfile?.avatar_url ?? undefined,
    });

    // Guard: Stream channel may not exist (e.g. after a dev DB wipe, or if
    // create-event's Stream call failed silently before the rollback path fired).
    const existingChannels = await streamServer.queryChannels(
      { type: 'messaging', id: { $eq: `event_${event_id}` } },
      {},
      { limit: 1 },
    );

    if (existingChannels.length === 0) {
      // Roll back the DB insert so the user is not stranded in event_participants
      // with no corresponding Stream membership.
      await rollbackInsert();
      return new Response(
        JSON.stringify({
          code: 'CHAT_ROOM_MISSING',
          error: "This event's chat room is unavailable. Please wait or contact the host.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 6. Add member to the Stream channel — roll back DB on failure
    try {
      const channel = streamServer.channel('messaging', `event_${event_id}`);
      await channel.addMembers([user.id]);
    } catch (streamErr: any) {
      console.error('[join-event] addMembers failed — rolling back DB insert:', streamErr);
      await rollbackInsert();
      throw streamErr; // re-thrown → caught by outer catch → 400 response
    }

    return new Response(JSON.stringify({ success: true, already_member: !didInsert }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
