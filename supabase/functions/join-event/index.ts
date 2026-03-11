// Supabase Edge Function: join-event
// Uses the join_event_atomic RPC for race-safe capacity checks.
// Stream.io membership is handled asynchronously by the sync-stream-member
// Edge Function (fired via pg_net database trigger on event_participants INSERT).
import { createClient } from 'npm:@supabase/supabase-js@2';

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

    // Already a member — the pg_net trigger won't fire again (no new INSERT)
    if (result.already_member) {
      return new Response(JSON.stringify({ success: true, already_member: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // New join — DB row inserted, pg_net trigger will async-add to Stream channel
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
