// Supabase Edge Function: send-push-notification
// Trigger: Called from DB triggers / other Edge Functions (service role only)
// Responsibilities:
//   1. Accept target user_id(s) + notification payload
//   2. Look up push_token(s) from profiles
//   3. Send via Expo Push API
//   4. Handle token cleanup for expired/invalid tokens

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushPayload {
  user_ids: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
}

Deno.serve(async (req: Request) => {
  // Only allow POST
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Verify the caller is authenticated (service role or valid JWT)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload: PushPayload = await req.json();
    const { user_ids, title, body, data, badge } = payload;

    if (!user_ids?.length || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'user_ids, title, and body are required' }),
        { status: 400 },
      );
    }

    // Fetch push tokens for all target users
    const { data: profiles, error: fetchError } = await supabase
      .from('profiles')
      .select('id, push_token')
      .in('id', user_ids)
      .not('push_token', 'is', null);

    if (fetchError) {
      console.error('[Push] Profile fetch error:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch tokens' }), { status: 500 });
    }

    if (!profiles?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'No push tokens found' }), {
        status: 200,
      });
    }

    // Build Expo push messages
    const messages = profiles
      .filter((p) => p.push_token?.startsWith('ExponentPushToken'))
      .map((p) => ({
        to: p.push_token!,
        sound: 'default' as const,
        title,
        body,
        data: data ?? {},
        badge: badge ?? 1,
        channelId: 'default',
      }));

    if (!messages.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'No valid tokens' }), { status: 200 });
    }

    // Send to Expo Push API (batches of 100)
    const invalidTokens: string[] = [];
    let totalSent = 0;

    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);

      const pushRes = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });

      if (!pushRes.ok) {
        console.error('[Push] Expo API error:', pushRes.status, await pushRes.text());
        continue;
      }

      const result = await pushRes.json();
      const tickets = result.data ?? [];

      // Check for invalid tokens
      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        if (ticket.status === 'ok') {
          totalSent++;
        } else if (
          ticket.details?.error === 'DeviceNotRegistered' ||
          ticket.details?.error === 'InvalidCredentials'
        ) {
          invalidTokens.push(batch[j].to);
        }
      }
    }

    // Clean up invalid tokens (fire-and-forget)
    if (invalidTokens.length > 0) {
      console.log('[Push] Cleaning up invalid tokens:', invalidTokens.length);
      for (const token of invalidTokens) {
        await supabase
          .from('profiles')
          .update({ push_token: null })
          .eq('push_token', token);
      }
    }

    return new Response(
      JSON.stringify({ sent: totalSent, invalid_cleaned: invalidTokens.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[Push] Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
