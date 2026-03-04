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
 * during development). Disconnects Stream, signs out of Supabase, clears every
 * AsyncStorage key, and resets in-memory Zustand stores so no stale data
 * (events, coordinates) leaks to the next user on the same device.
 */
export async function forceGlobalSignOut(): Promise<void> {
  // 1. Disconnect Stream (dynamic import avoids circular dep: streamClient → supabase)
  try {
    const { streamClient } = await import('./streamClient');
    if (streamClient.userID) {
      await streamClient.disconnectUser();
    }
  } catch (err) {
    console.warn('[forceGlobalSignOut] Stream disconnect failed:', err);
  }

  // 2. Sign out of Supabase (clears its own AsyncStorage keys)
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[forceGlobalSignOut] Supabase signOut failed:', err);
  }

  // 3. Clear all remaining AsyncStorage keys (nomadmeet-auth Zustand store, etc.)
  try {
    await AsyncStorage.clear();
  } catch (err) {
    console.warn('[forceGlobalSignOut] AsyncStorage.clear failed:', err);
  }

  // 4. Reset in-memory Zustand stores (B-1 / B-2).
  //    These are not persisted to disk but survive the JS session, so without an
  //    explicit reset User 2 briefly sees User 1's stale map events / coordinates.
  try {
    const { useMapStore } = await import('../stores/mapStore');
    const { useLocationStore } = await import('../stores/locationStore');
    useMapStore.getState().setEvents([]);
    useLocationStore.getState().setCoordinates(null);
  } catch (err) {
    console.warn('[forceGlobalSignOut] Store reset failed:', err);
  }
}
