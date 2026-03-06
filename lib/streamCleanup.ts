import { streamClient } from './streamClient';
import { supabase } from './supabase';

/**
 * Purges Stream channels whose backing Supabase event no longer exists
 * OR has expired.
 *
 * Flow:
 *  1. Query all `messaging` channels the current user belongs to.
 *  2. Extract event IDs from channel IDs (format: `event_{uuid}`).
 *  3. Cross-reference against the `events` table — only ACTIVE events pass.
 *  4. Any channel whose event is missing or expired → hard delete via
 *     `channel.delete()` (not just hide).
 *
 * Safe to call on any screen focus — short-circuits if Stream isn't connected.
 */
export async function purgeGhostChannels(): Promise<number> {
  if (!streamClient.userID) return 0;

  try {
    const channels = await streamClient.queryChannels(
      { type: 'messaging', members: { $in: [streamClient.userID] } },
      {},
      { limit: 30 },
    );

    if (channels.length === 0) return 0;

    // Build a map: eventId → channel
    const channelsByEventId = new Map<string, (typeof channels)[number]>();
    for (const ch of channels) {
      const rawId = ch.id ?? '';
      const eventId = rawId.startsWith('event_') ? rawId.slice('event_'.length) : rawId;
      channelsByEventId.set(eventId, ch);
    }

    // Check which events still exist AND are active (not expired)
    const eventIds = [...channelsByEventId.keys()];
    const { data: existing } = await supabase
      .from('events')
      .select('id, status')
      .in('id', eventIds);

    const activeIds = new Set(
      (existing ?? [])
        .filter((e: { id: string; status: string }) => e.status === 'active')
        .map((e: { id: string }) => e.id),
    );

    // Hard-delete ghost channels (missing OR expired)
    let purged = 0;
    const deletePromises: Promise<void>[] = [];
    for (const [eventId, ch] of channelsByEventId) {
      if (!activeIds.has(eventId)) {
        deletePromises.push(
          ch.delete()
            .then(() => {
              console.log('[GhostPurge] Deleted channel:', ch.id);
            })
            .catch((err) => {
              // Channel may already be deleted server-side — not fatal
              console.warn('[GhostPurge] delete failed:', ch.id, err?.message ?? err);
            }),
        );
        purged++;
      }
    }

    // Await all deletions so the UI refreshes within the same focus cycle
    if (deletePromises.length > 0) {
      await Promise.allSettled(deletePromises);
    }

    if (purged > 0) {
      console.log(`[GhostPurge] Cleaned up ${purged} orphaned/expired channel(s)`);
    }

    return purged;
  } catch (err) {
    console.warn('[GhostPurge] Error:', err);
    return 0;
  }
}
