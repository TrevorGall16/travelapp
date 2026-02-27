import { StreamChat } from 'stream-chat';

const apiKey = process.env.EXPO_PUBLIC_STREAM_API_KEY ?? '';

/**
 * Singleton StreamChat client.
 * `getInstance()` is safe to call multiple times with the same key — it
 * returns the existing instance if one already exists.
 *
 * Connection lifecycle:
 *  - Call `streamClient.connectUser(userInfo, token)` once after login
 *    (see app/event/[id].tsx — idempotent guard: `if (!streamClient.userID)`)
 *  - Do NOT disconnect on individual screen unmounts; the client stays alive
 *    for the entire app session and is shared across all chat screens.
 */
export const streamClient = StreamChat.getInstance(apiKey);
