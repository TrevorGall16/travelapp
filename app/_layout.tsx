import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
import { OverlayProvider } from 'stream-chat-expo';
import { Colors } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { streamClient } from '../lib/streamClient';
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

    const fetchStreamToken = async (accessToken: string): Promise<string | null> => {
      console.log('[Stream] fetchStreamToken → invoking generate-stream-token...');

      // Retry with exponential backoff — handles flaky travel WiFi
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const { data, error } = await supabase.functions.invoke('generate-stream-token', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (error) {
            console.error(`[Stream] Edge Function error (attempt ${attempt}):`, error.message ?? JSON.stringify(error));
            if (attempt < maxAttempts) {
              const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
              console.warn(`[Stream] Retrying fetchStreamToken in ${delay}ms...`);
              await new Promise(r => setTimeout(r, delay));
              continue;
            }
            return null;
          }

          if (typeof data?.token !== 'string' || data.token.length === 0) {
            console.error('[Stream] Token missing or invalid in response. Full data:', JSON.stringify(data));
            return null;
          }

          console.log('[Stream] Token received OK, length:', data.token.length);
          if (isMounted) setStreamToken(data.token);
          return data.token;
        } catch (err) {
          console.error(`[Stream] fetchStreamToken attempt ${attempt} threw:`, err);
          if (attempt < maxAttempts) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          return null;
        }
      }
      return null;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

if (session?.user) {
          // 1. Fetch the profile FIRST before updating the store
          const profileData = await fetchProfile(session.user.id);
          
          if (!isMounted) return;

          // 2. Set both together so the UI doesn't "blink"
          setUser(session.user);
          setProfile(profileData);

          // 3. Fetch Stream token + connect when profile is complete.
          // TOKEN_REFRESHED is included because Stream tokens now expire (24h) —
          // when Supabase auto-refreshes the JWT, we also refresh the Stream token.
          if (isProfileComplete(profileData) && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
            const token = await fetchStreamToken(session.access_token);
            // Connect Stream user centrally — all chat screens rely on this.
            if (token && isMounted) {
              try {
                const streamUserData = {
                  id: session.user.id,
                  name: profileData?.display_name ?? undefined,
                  image: profileData?.avatar_url ?? undefined,
                };

                if (!streamClient.userID) {
                  // Retry with exponential backoff for poor-wifi scenarios
                  let attempt = 0;
                  const maxAttempts = 3;
                  while (attempt < maxAttempts) {
                    try {
                      await streamClient.connectUser(streamUserData, token);
                      console.log('[Stream] connectUser succeeded (root layout)');
                      break;
                    } catch (connectErr) {
                      attempt++;
                      if (attempt >= maxAttempts) throw connectErr;
                      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
                      console.warn(`[Stream] connectUser attempt ${attempt} failed, retrying in ${delay}ms`);
                      await new Promise(r => setTimeout(r, delay));
                    }
                  }
                }

                // Strict Sync: upsertUser on every boot to guarantee
                // Stream always has the latest name + avatar.
                if (streamClient.userID && isMounted) {
                  await streamClient.upsertUser(streamUserData);
                  console.log('[Stream] upsertUser strict sync done');
                }
              } catch (err) {
                console.error('[Stream] connectUser/upsertUser failed (root layout):', err);
              }
            }
          }
        } else {
          // Disconnect Stream before clearing auth state
          if (streamClient.userID) {
            streamClient.disconnectUser().catch((err) =>
              console.warn('[Stream] disconnectUser failed:', err),
            );
          }
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

  // ── Strict Sync: upsertUser whenever profile changes (e.g. Edit Profile) ─
  useEffect(() => {
    if (!profile || !streamClient.userID) return;
    const current = streamClient.user;
    if (
      current?.name !== profile.display_name ||
      current?.image !== profile.avatar_url
    ) {
      streamClient
        .upsertUser({
          id: streamClient.userID,
          name: profile.display_name ?? undefined,
          image: profile.avatar_url ?? undefined,
        })
        .then(() => console.log('[Stream] upsertUser profile sync done'))
        .catch((err) =>
          console.warn('[Stream] upsertUser sync failed:', err),
        );
    }
  }, [profile]);

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
        {/* OverlayProvider must live here — above every screen and every KAV —
            so that Stream's gorhom/bottom-sheet snap-point math always operates
            against the full hardware screen. Placing it inside any screen's KAV
            causes the "ghost drag handle" bug when the keyboard closes. */}
        <OverlayProvider>
        {!isInitialized ? (
          <View style={styles.splash} />
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            {setupComplete && <Stack.Screen name="(tabs)" />}
            <Stack.Screen name="event/create" options={{ presentation: 'modal' }} />
            <Stack.Screen name="event/[id]" />
            <Stack.Screen name="event/edit-location" />
            <Stack.Screen name="user/[id]" />
            <Stack.Screen name="profile/edit" />
            <Stack.Screen name="profile/preview" />
            <Stack.Screen name="profile/settings" />
            <Stack.Screen name="profile/contact" />
            <Stack.Screen name="profile/privacy" />
            <Stack.Screen name="profile/terms" />
            <Stack.Screen name="notifications" />
          </Stack>
        )}
        </OverlayProvider>
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
