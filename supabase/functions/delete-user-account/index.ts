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

  // We use the service role key to initialize the client, but use the caller's JWT to verify who they are
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

  if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

  // ── 1. Delete from Stream.io ──
  try {
    const streamServer = StreamChat.getInstance(STREAM_API_KEY, STREAM_SECRET_KEY);
    // Hard delete removes the user and anonymizes/deletes their messages
    await streamServer.deleteUser(user.id, { hard_delete: true, mark_messages_deleted: true });
  } catch (streamErr) {
    console.error('[delete-user-account] Stream deletion failed:', streamErr);
    // CRITICAL: Do NOT abort. If Stream fails, we still MUST delete the user from our main DB.
  }

  // ── 2. Delete from Supabase Auth ──
  // Using the admin API deletes the user from auth.users. 
  // Because we set up ON DELETE CASCADE in your SQL script, this will automatically 
  // wipe their row in `profiles`, `events`, `event_participants`, etc.
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

  if (deleteError) {
    console.error('[delete-user-account] Supabase deletion failed:', deleteError.message);
    return jsonResponse({ error: 'Failed to delete user account' }, 500);
  }

  return jsonResponse({ success: true });
});