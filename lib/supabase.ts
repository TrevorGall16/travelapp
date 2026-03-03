import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Nuclear reset — use when local state becomes corrupted (e.g. after DB wipes
 * during development). Disconnects Stream, signs out of Supabase, then clears
 * every AsyncStorage key so no stale tokens or cached data survive.
 */
export async function forceGlobalSignOut(): Promise<void> {
  try {
    // Dynamic import avoids a circular dependency (streamClient imports supabase)
    const { streamClient } = await import('./streamClient');
    if (streamClient.userID) {
      await streamClient.disconnectUser();
    }
  } catch (err) {
    console.warn('[forceGlobalSignOut] Stream disconnect failed:', err);
  }

  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[forceGlobalSignOut] Supabase signOut failed:', err);
  }

  try {
    await AsyncStorage.clear();
  } catch (err) {
    console.warn('[forceGlobalSignOut] AsyncStorage.clear failed:', err);
  }
}
