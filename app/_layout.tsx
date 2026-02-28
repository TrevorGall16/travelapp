import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Profile } from '../types';

export default function RootLayout() {
  const {
    user,
    profile,
    isInitialized,
    setUser,
    setProfile,
    setStreamToken,
    setInitialized,
    clearAuth,
  } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  // ── Auth initialization ──────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    let initialEventFired = false;

    const fetchProfile = async (userId: string): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Retry once on transient network errors
        const { data: retryData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        return retryData ?? null;
      }
      return data;
    };

    const fetchStreamToken = async () => {
      console.log('[Stream] fetchStreamToken → invoking generate-stream-token...');
      try {
        const { data, error } = await supabase.functions.invoke('generate-stream-token');

        // Log the full raw response so we can see exactly what came back.
        console.log('[Stream] generate-stream-token raw response →',
          'data:', JSON.stringify(data),
          '| error:', JSON.stringify(error),
        );

        if (error) {
          console.error('[Stream] Edge Function returned an error:', error.message ?? JSON.stringify(error));
          return;
        }

        if (typeof data?.token !== 'string' || data.token.length === 0) {
          console.error('[Stream] Token missing or invalid in response. Full data:', JSON.stringify(data));
          return;
        }

        console.log('[Stream] Token received OK, length:', data.token.length);
        if (isMounted) setStreamToken(data.token);
      } catch (err) {
        console.error('[Stream] fetchStreamToken threw unexpectedly:', err);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        if (session?.user) {
          setUser(session.user);

          const profileData = await fetchProfile(session.user.id);
          if (!isMounted) return;
          setProfile(profileData);

          // Only fetch Stream token for users who have completed setup.
          // New users (display_name null) don't need it yet.
          const setupDone = !!profileData?.display_name?.trim();
          if (setupDone && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
            await fetchStreamToken();
          }
        } else {
          clearAuth();
        }

        // Mark the app as ready after the very first auth event resolves.
        // setInitialized fires AFTER setProfile, so the navigation guard
        // always sees a consistent (user + profile) pair on its first run.
        if (!initialEventFired) {
          initialEventFired = true;
          if (isMounted) setInitialized(true);
        }
      },
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Navigation guard ─────────────────────────────────────────────────────
  useEffect(() => {
    // isInitialized only becomes true AFTER the first onAuthStateChange fires
    // and setProfile has been called — so user + profile are always in sync here.
    if (!isInitialized) return;

    // /(auth)/setup  →  segments = ['(auth)', 'setup']
    // /(auth)/       →  segments = ['(auth)', 'index'] or ['(auth)']
    // /(tabs)/       →  segments = ['(tabs)', 'index'] or ['(tabs)']
    const inAuthGroup  = segments[0] === '(auth)';
    const onSetupScreen = inAuthGroup && segments[1] === 'setup';

    if (!user) {
      // Logged out — ensure we're in the auth group
      if (!inAuthGroup) router.replace('/(auth)/');

    } else if (!profile?.display_name?.trim()) {
      // Logged in but setup not complete (display_name is null/empty).
      // Only redirect if we're not already on setup to prevent loops.
      if (!onSetupScreen) router.replace('/(auth)/setup');

    } else {
      // Logged in + setup complete.
      // If still inside the auth group (login screen, setup, splash), push to tabs.
      if (inAuthGroup) router.replace('/(tabs)/');
    }
  }, [user, profile, isInitialized, segments, router]);

  // setupComplete gates whether (tabs) screens are included in the navigator.
  // When false, (tabs) literally cannot mount — preventing the map screen from
  // firing the location permission dialog before setup is done.
  const setupComplete = !!user && !!profile?.display_name?.trim();

return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {!isInitialized ? (
          <View style={{ flex: 1, backgroundColor: '#0F172A' }} />
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="setup" />
            <Stack.Screen name="event/create" options={{ presentation: 'modal' }} />
            <Stack.Screen name="event/[id]" />
            <Stack.Screen name="user/[id]" />
          </Stack>
        )}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
