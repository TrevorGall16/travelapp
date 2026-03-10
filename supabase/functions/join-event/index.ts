// Supabase Edge Function: join-event
// Uses the join_event_atomic RPC for race-safe capacity checks.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { StreamChat } from 'npm:stream-chat@8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const STREAM_API_KEY = Deno.env.get('EXPO_PUBLIC_STREAM_API_KEY')!;
    const STREAM_SECRET_KEY = Deno.env.get('STREAM_SECRET_KEY')!;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Verify caller JWT
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

    // 2. Atomic join — SELECT FOR UPDATE prevents race-condition overfill
    const { data: result, error: rpcError } = await supabaseAdmin.rpc('join_event_atomic', {
      p_user_id: user.id,
      p_event_id: event_id,
    });

    if (rpcError) throw new Error(rpcError.message);

    // If the RPC returned a non-ok result, forward the code to the client
    if (!result.ok) {
      return new Response(JSON.stringify({ code: result.code, error: result.error }), {
        status: result.code === 'NOT_FOUND' ? 404 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Already a member — skip Stream sync, return early
    if (result.already_member) {
      return new Response(JSON.stringify({ success: true, already_member: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Stream Chat Sync — only for NEW joins
    const streamServer = StreamChat.getInstance(STREAM_API_KEY, STREAM_SECRET_KEY);

    // Upsert the Stream user before channel operations
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

    // Guard: verify Stream channel exists
    const existingChannels = await streamServer.queryChannels(
      { type: 'messaging', id: { $eq: `event_${event_id}` } },
      {},
      { limit: 1 },
    );

    if (existingChannels.length === 0) {
      // Roll back the DB insert — the RPC already committed, so we need a manual delete
      await supabaseAdmin
        .from('event_participants')
        .delete()
        .eq('event_id', event_id)
        .eq('user_id', user.id);

      return new Response(
        JSON.stringify({
          code: 'CHAT_ROOM_MISSING',
          error: "This event's chat room is unavailable. Please wait or contact the host.",
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. Add member to Stream channel — roll back DB on failure
    try {
      const channel = streamServer.channel('messaging', `event_${event_id}`);
      await channel.addMembers([user.id]);
    } catch (streamErr: any) {
      console.error('[join-event] addMembers failed — rolling back:', streamErr);
      await supabaseAdmin
        .from('event_participants')
        .delete()
        .eq('event_id', event_id)
        .eq('user_id', user.id);
      throw streamErr;
    }

    return new Response(JSON.stringify({ success: true, already_member: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
