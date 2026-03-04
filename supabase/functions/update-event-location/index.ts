// Supabase Edge Function: update-event-location
// Trigger: Client call from app/event/edit-location.tsx
// Responsibilities:
//   1. Verify caller JWT
//   2. Verify caller is the event host
//   3. Update event location as PostGIS point
//   4. Return updated event data

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // 1. Verify JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing authorization header' }, 401);
  }
  const jwt = authHeader.replace('Bearer ', '');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // 2. Parse & validate body
  let body: { event_id: string; latitude: number; longitude: number };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { event_id, latitude, longitude } = body;

  if (
    typeof event_id !== 'string' || !event_id ||
    typeof latitude !== 'number' || !isFinite(latitude) ||
    typeof longitude !== 'number' || !isFinite(longitude)
  ) {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  // 3. Verify the caller is the host
  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('host_id, status')
    .eq('id', event_id)
    .single();

  if (fetchError || !event) {
    return jsonResponse({ error: 'Event not found' }, 404);
  }

  if (event.host_id !== user.id) {
    return jsonResponse({ error: 'Only the host can update the event location' }, 403);
  }

  if (event.status !== 'active') {
    return jsonResponse({ error: 'Cannot update an expired event' }, 400);
  }

  // 4. Update location
  const { error: updateError } = await supabase
    .from('events')
    .update({
      location: `SRID=4326;POINT(${longitude} ${latitude})`,
    })
    .eq('id', event_id);

  if (updateError) {
    console.error('[update-event-location] update error:', updateError.message);
    return jsonResponse({ error: 'Failed to update location' }, 500);
  }

  return jsonResponse({ success: true });
});
