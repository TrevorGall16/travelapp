/**
 * clear-stream-channels.mjs
 *
 * Deletes every Stream Chat channel whose id starts with "event_".
 * Handles pagination (Stream returns max 30 channels per query).
 *
 * Usage:
 *   node scripts/clear-stream-channels.mjs
 *
 * Requires a .env file in the project root with:
 *   EXPO_PUBLIC_STREAM_API_KEY=...
 *   STREAM_SECRET_KEY=...
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

// ---------------------------------------------------------------------------
// Bootstrap dotenv — resolve .env relative to the project root (one level up
// from /scripts), not the cwd the caller may be using.
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// dotenv is a CommonJS package; use createRequire for ESM compatibility.
const require = createRequire(import.meta.url);
const dotenv  = require('dotenv');

dotenv.config({ path: path.join(projectRoot, '.env') });

const STREAM_API_KEY    = process.env.EXPO_PUBLIC_STREAM_API_KEY;
const STREAM_SECRET_KEY = process.env.STREAM_SECRET_KEY;

if (!STREAM_API_KEY || !STREAM_SECRET_KEY) {
  console.error(
    '[clear-stream-channels] Missing env vars.\n' +
    'Ensure EXPO_PUBLIC_STREAM_API_KEY and STREAM_SECRET_KEY are set in .env'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// stream-chat is also CommonJS in most installed versions; require() it.
// ---------------------------------------------------------------------------
const { StreamChat } = require('stream-chat');

const PAGE_SIZE = 30; // Stream's documented maximum per queryChannels call

async function main() {
  const client = StreamChat.getInstance(STREAM_API_KEY, STREAM_SECRET_KEY);

  let totalDeleted = 0;
  let offset       = 0;
  let page;

  console.log('[clear-stream-channels] Starting scan for event_* channels...');

  do {
    // Query one page of messaging channels whose id begins with "event_".
    // Stream supports the $autocomplete operator for prefix matching on id.
    page = await client.queryChannels(
      {
        type: 'messaging',
        id:   { $autocomplete: 'event_' },
      },
      // Sort by cid for stable pagination across calls.
      [{ field: 'cid', direction: 1 }],
      {
        limit:  PAGE_SIZE,
        offset,
        // We only need the channel identity — skip heavy member/message hydration.
        state:         false,
        watch:         false,
        presence:      false,
        message_limit: 0,
      },
    );

    if (page.length === 0) {
      if (offset === 0) {
        console.log('[clear-stream-channels] No event_* channels found. Nothing to delete.');
      }
      break;
    }

    for (const channel of page) {
      try {
        // hard-delete removes the channel and all its messages from Stream.
        await channel.delete();
        console.log(`Deleted channel: ${channel.id}`);
        totalDeleted++;
      } catch (err) {
        console.error(`Failed to delete channel ${channel.id}:`, err.message ?? err);
      }
    }

    offset += page.length;

  } while (page.length === PAGE_SIZE);
  // If the page came back full (PAGE_SIZE) there may be more; keep paginating.
  // A page shorter than PAGE_SIZE means we have reached the end.

  console.log(`Done. Deleted ${totalDeleted} channel${totalDeleted === 1 ? '' : 's'} total.`);
}

main().catch((err) => {
  console.error('[clear-stream-channels] Fatal error:', err);
  process.exit(1);
});
