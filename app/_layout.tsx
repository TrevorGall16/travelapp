import { useEffect } from 'react';
import { View } from 'react-native';
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
      try {
        const { data } = await supabase.functions.invoke('generate-stream-token');
        if (isMounted && typeof data?.token === 'string') {
          setStreamToken(data.token);
        }
      } catch (err) {
        console.error('[Auth] - RootLayout - generate-stream-token failed:', err);
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

          // Fetch Stream token on login or app launch (not on every token refresh)
          if (profileData && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
            await fetchStreamToken();
          }
        } else {
          clearAuth();
        }

        // Mark the app as ready after the very first auth event
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
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onSetupScreen = segments[1] === 'setup';

    if (!user) {
      if (!inAuthGroup) router.replace('/(auth)/');
    } else if (!profile) {
      if (!onSetupScreen) router.replace('/(auth)/setup');
    } else if (inAuthGroup) {
      router.replace('/(tabs)/');
    }
  }, [user, profile, isInitialized, segments, router]);

  // Blank dark screen while Supabase resolves the initial session
  if (!isInitialized) {
    return <View style={{ flex: 1, backgroundColor: '#0F172A' }} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="event/create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="event/[id]" />
      <Stack.Screen name="user/[id]" />
      <Stack.Screen name="settings/index" />
      <Stack.Screen name="settings/verified" />
    </Stack>
  );
}
