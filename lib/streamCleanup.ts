import { streamClient } from './streamClient';
import { supabase } from './supabase';

/**
 * Purges Stream channels whose backing Supabase event no longer exists.
 *
 * Flow:
 *  1. Query all `messaging` channels the current user belongs to.
 *  2. Extract event IDs from channel IDs (format: `event_{uuid}`).
 *  3. Cross-reference against the `events` table.
 *  4. Any channel whose event is missing → hide from the user + delete in background.
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

    // Check which events still exist
    const eventIds = [...channelsByEventId.keys()];
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .in('id', eventIds);

    const existingIds = new Set((existing ?? []).map((e: { id: string }) => e.id));

    // Delete ghost channels
    let purged = 0;
    for (const [eventId, ch] of channelsByEventId) {
      if (!existingIds.has(eventId)) {
        ch.delete().catch((err) =>
          console.warn('[GhostPurge] delete failed:', ch.id, err),
        );
        purged++;
      }
    }

    if (purged > 0) {
      console.log(`[GhostPurge] Cleaned up ${purged} orphaned channel(s)`);
    }

    return purged;
  } catch (err) {
    console.warn('[GhostPurge] Error:', err);
    return 0;
  }
}
