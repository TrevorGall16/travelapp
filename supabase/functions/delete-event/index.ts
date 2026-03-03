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

// 3. Delete from Stream Chat (with Ghost Protection)
    const streamServer = StreamChat.getInstance(
      Deno.env.get('EXPO_PUBLIC_STREAM_API_KEY')!,
      Deno.env.get('STREAM_SECRET_KEY')!
    );
    const channel = streamServer.channel('messaging', `event_${event_id}`);
    
    try {
      await channel.delete();
    } catch (streamErr: any) {
      // If code 16, the channel is already gone. We don't care, just keep going.
      if (streamErr.code !== 16) {
        throw streamErr;
      }
      console.log('[delete-event] Stream channel already missing, skipping...');
    }

    // 4. Delete from Supabase (Cascade will handle participants)
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