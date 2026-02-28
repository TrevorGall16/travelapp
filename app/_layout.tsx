import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Colors } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Profile } from '../types';

/** A profile is only complete when the user has explicitly finished setup.
 *  String-based checks on display_name/country_code are unreliable because
 *  the handle_new_user() trigger inserts placeholder values to satisfy NOT NULL
 *  constraints (e.g. pulling display_name from Google OAuth metadata).
 *  The setup_completed boolean is the single authoritative source of truth. */
function isProfileComplete(profile: Profile | null): boolean {
  return profile?.setup_completed === true;
}

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

        console.log(
          '[Stream] generate-stream-token raw response →',
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
          // New users (setup_completed = false) don't need it yet.
          if (isProfileComplete(profileData) && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
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

    const inAuthGroup  = segments[0] === '(auth)';
    const onSetupScreen = inAuthGroup && segments[1] === 'setup';
    const profileDone  = isProfileComplete(profile);

    if (!user) {
      // Logged out — ensure we're in the auth group.
      if (!inAuthGroup) router.replace('/(auth)/');

    } else if (!profileDone) {
      // Logged in but onboarding not complete.
      // Requires BOTH display_name and country_code to be non-empty.
      // Guard against redirect loops by checking we're not already on setup.
      if (!onSetupScreen) router.replace('/(auth)/setup');

    } else {
      // Logged in + fully onboarded.
      // If still inside the auth group (login, setup, splash), push to tabs.
      if (inAuthGroup) router.replace('/(tabs)/');
    }
  }, [user, profile, isInitialized, segments, router]);

  // setupComplete gates whether (tabs) screens are included in the navigator.
  // When false, (tabs) literally cannot mount — preventing the map screen from
  // firing the location permission dialog before setup is done, and eliminating
  // the one-second flash caused by Expo Router mounting the screen before the
  // navigation guard's redirect fires.
  const setupComplete = !!user && isProfileComplete(profile);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.flex}>
        {!isInitialized ? (
          <View style={styles.splash} />
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            {setupComplete && <Stack.Screen name="(tabs)" />}
            <Stack.Screen name="event/create" options={{ presentation: 'modal' }} />
            <Stack.Screen name="event/[id]" />
            <Stack.Screen name="user/[id]" />
          </Stack>
        )}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  splash: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
