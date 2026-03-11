// Supabase Edge Function: sync-stream-member
// Called asynchronously by a Database Webhook (pg_net trigger) when a row
// is INSERTed into event_participants. Adds the user to the Stream channel.
// Safe to retry — addMembers is idempotent in Stream.

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

    // Parse webhook payload — supports both Dashboard Webhook and pg_net trigger formats
    const body = await req.json();
    const record = body.record ?? body;
    const { event_id, user_id } = record;

    if (!event_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing event_id or user_id in payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const streamServer = StreamChat.getInstance(STREAM_API_KEY, STREAM_SECRET_KEY);

    // Fetch user profile for Stream upsert
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user_id)
      .single();

    // Upsert user in Stream (idempotent)
    await streamServer.upsertUser({
      id: user_id,
      name: profile?.display_name ?? 'Traveler',
      image: profile?.avatar_url ?? undefined,
    });

    // Verify Stream channel exists before adding member
    const channelId = `event_${event_id}`;
    const existing = await streamServer.queryChannels(
      { type: 'messaging', id: { $eq: channelId } },
      {},
      { limit: 1 },
    );

    if (existing.length === 0) {
      console.warn(`[sync-stream-member] Channel ${channelId} not found — skipping.`);
      return new Response(
        JSON.stringify({ ok: false, reason: 'channel_not_found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Add member to Stream channel (idempotent — safe to retry)
    const channel = streamServer.channel('messaging', channelId);
    await channel.addMembers([user_id]);

    console.log(`[sync-stream-member] Added ${user_id} to ${channelId}`);

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('[sync-stream-member] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
