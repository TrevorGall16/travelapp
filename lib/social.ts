// lib/social.ts — Connection (friend handshake) helpers
//
// Status lifecycle:
//   none → pending (sendRequest) → accepted (acceptRequest)
//   accepted → none (removeConnection)
//   pending → none (cancelRequest / ignoreRequest)

import { supabase } from './supabase';

export type ConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

/**
 * Check the connection status between the current user and another user.
 * Returns a discriminated status so the UI knows which button to show.
 */
export async function checkConnectionStatus(
  myId: string,
  otherId: string,
): Promise<ConnectionStatus> {
  const { data, error } = await supabase
    .from('connections')
    .select('user_id_1, status')
    .or(
      `and(user_id_1.eq.${myId},user_id_2.eq.${otherId}),` +
      `and(user_id_1.eq.${otherId},user_id_2.eq.${myId})`,
    )
    .maybeSingle();

  if (error || !data) return 'none';

  if (data.status === 'accepted') return 'accepted';

  // pending — determine direction
  return data.user_id_1 === myId ? 'pending_sent' : 'pending_received';
}

/**
 * Send a connection request. Caller must be user_id_1.
 * Idempotent: if the row already exists the unique constraint blocks duplicates.
 */
export async function sendConnectionRequest(
  myId: string,
  otherId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('connections').insert({
    user_id_1: myId,
    user_id_2: otherId,
    status: 'pending',
  });

  if (error) {
    // 23505 = unique_violation — already exists
    if (error.code === '23505') return { ok: true };
    return { ok: false, error: error.message };
  }

  // Fire-and-forget notification insert
  supabase.from('notifications').insert({
    user_id: otherId,
    type: 'friend_request',
    from_user_id: myId,
  }).then(() => {});

  return { ok: true };
}

/**
 * Accept a pending request. Caller must be user_id_2 (the receiver).
 */
export async function acceptConnectionRequest(
  myId: string,
  otherId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('connections')
    .update({ status: 'accepted' })
    .eq('user_id_1', otherId)
    .eq('user_id_2', myId)
    .eq('status', 'pending');

  if (error) return { ok: false, error: error.message };

  // Notify the requester
  supabase.from('notifications').insert({
    user_id: otherId,
    type: 'request_accepted',
    from_user_id: myId,
  }).then(() => {});

  return { ok: true };
}

/**
 * Remove a connection (unfriend) or cancel/ignore a pending request.
 * Either party can call this.
 */
export async function removeConnection(
  myId: string,
  otherId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('connections')
    .delete()
    .or(
      `and(user_id_1.eq.${myId},user_id_2.eq.${otherId}),` +
      `and(user_id_1.eq.${otherId},user_id_2.eq.${myId})`,
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
