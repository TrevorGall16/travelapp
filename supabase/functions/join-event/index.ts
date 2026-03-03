// Supabase Edge Function: join-event
import { createClient } from 'npm:@supabase/supabase-js@2';
import { StreamChat } from 'npm:stream-chat@8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // DEBUG: log every header the function receives so we can confirm what token
  // the client is actually sending. Remove once the 401 root cause is confirmed.
  console.log('FUNCTION TRIGGERED - HEADERS:', JSON.stringify(Object.fromEntries(req.headers.entries())));

  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const STREAM_API_KEY = Deno.env.get('EXPO_PUBLIC_STREAM_API_KEY')!;
    const STREAM_SECRET_KEY = Deno.env.get('STREAM_SECRET_KEY')!;

    // Initialize Service Client (High Privileges)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get User from Header - This is the standard way to get the caller's ID
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { event_id } = await req.json();

    // 2. Fetch Event
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('status, verified_only')
      .eq('id', event_id)
      .single();

    if (eventError || !event) throw new Error('Event not found');
    if (event.status !== 'active') throw new Error('EVENT_EXPIRED');

    // 3. Insert Participant (Idempotent)
    const { error: insertError } = await supabaseAdmin
      .from('event_participants')
      .insert({ event_id, user_id: user.id });

    // Handle "Already Joined" - Code 23505 is unique violation
    if (insertError && insertError.code !== '23505') throw insertError;

    // 4. Stream Chat Sync
    const streamServer = StreamChat.getInstance(STREAM_API_KEY, STREAM_SECRET_KEY);
    const channel = streamServer.channel('messaging', `event_${event_id}`);
    await channel.addMembers([user.id]);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.message === 'EVENT_EXPIRED' ? 200 : 400,
    });
  }
});