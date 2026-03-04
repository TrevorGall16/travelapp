import { createClient } from 'npm:@supabase/supabase-js@2';
import { StreamChat } from 'npm:stream-chat@8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Verify User
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error('Unauthorized');

    const { event_id } = await req.json();

    // 2. Verify Ownership (Only host can delete)
    const { data: event, error: fetchError } = await supabaseAdmin
      .from('events')
      .select('host_id')
      .eq('id', event_id)
      .single();

    if (fetchError || !event) throw new Error('Event not found');
    if (event.host_id !== user.id) throw new Error('Only the host can delete this event');

    // 3a. Soft-delete DB row first — blocks new joins immediately while we clean up Stream.
    // This is the canonical "deleted" signal; new join attempts will see status !== 'active'.
    const { error: softDeleteError } = await supabaseAdmin
      .from('events')
      .update({ status: 'deleted' })
      .eq('id', event_id);

    if (softDeleteError) throw softDeleteError;

    // 3b. Delete Stream channel — if it fails (and it's not already gone), roll back the soft-delete.
    const streamServer = StreamChat.getInstance(
      Deno.env.get('EXPO_PUBLIC_STREAM_API_KEY')!,
      Deno.env.get('STREAM_SECRET_KEY')!
    );
    const channel = streamServer.channel('messaging', `event_${event_id}`);

    try {
      await channel.delete();
    } catch (streamErr: any) {
      if (streamErr.code !== 16) {
        // Non-404 error — roll back the soft-delete so the event is still visible
        await supabaseAdmin
          .from('events')
          .update({ status: 'active' })
          .eq('id', event_id);
        throw streamErr;
      }
      // code 16 = channel already missing — safe to proceed
      console.log('[delete-event] Stream channel already missing, skipping...');
    }

    // 3c. Hard delete DB row — cascade handles event_participants
    const { error: deleteError } = await supabaseAdmin
      .from('events')
      .delete()
      .eq('id', event_id);

    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
