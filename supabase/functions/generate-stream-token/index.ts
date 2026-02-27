import { createClient } from 'npm:@supabase/supabase-js@2';
import { StreamChat } from 'npm:stream-chat@8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STREAM_API_KEY = Deno.env.get('EXPO_PUBLIC_STREAM_API_KEY')!;
const STREAM_SECRET_KEY = Deno.env.get('STREAM_SECRET_KEY')!;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Missing auth header' }, 401);
  const jwt = authHeader.replace('Bearer ', '');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: { user }, error } = await supabase.auth.getUser(jwt);

  if (error || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

  try {
    const streamServer = StreamChat.getInstance(STREAM_API_KEY, STREAM_SECRET_KEY);
    // Create a secure token that does not expire automatically (standard for Stream UI kits)
    const token = streamServer.createToken(user.id);
    return jsonResponse({ token });
  } catch (err) {
    console.error('[generate-stream-token] Error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});