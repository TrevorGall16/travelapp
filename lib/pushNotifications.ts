// lib/pushNotifications.ts — Expo Push Notification registration + listeners
//
// Call `registerForPushNotifications()` after auth + profile setup.
// Call `usePushNotificationListeners()` in root layout to handle taps.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { supabase } from './supabase';

// ── Foreground notification presentation ─────────────────────────────────────
// Show banner + badge + sound even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ── Register for push notifications ──────────────────────────────────────────
// Returns the Expo push token string, or null if permissions denied / simulator.
export async function registerForPushNotifications(
  userId: string,
): Promise<string | null> {
  // Push doesn't work on simulators
  if (!Device.isDevice) {
    console.log('[Push] Not a physical device — skipping registration');
    return null;
  }

  // Check / request permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission not granted');
    return null;
  }

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1DA1F2',
    });
  }

  // Get token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    });
    const token = tokenData.data;
    console.log('[Push] Token:', token);

    // Persist to profile row (fire-and-forget — non-blocking)
    supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) console.warn('[Push] Failed to save token:', error.message);
        else console.log('[Push] Token saved to profile');
      });

    return token;
  } catch (err) {
    console.error('[Push] getExpoPushTokenAsync failed:', err);
    return null;
  }
}

// ── Clear push token on sign-out ─────────────────────────────────────────────
export async function clearPushToken(userId: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ push_token: null })
    .eq('id', userId)
    .then(({ error }) => {
      if (error) console.warn('[Push] Failed to clear token:', error.message);
    });
}

// ── Notification tap handler ─────────────────────────────────────────────────
// Call this in root layout useEffect to handle taps (cold start + warm).
export function setupNotificationResponseListener(): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;

    // Route based on notification payload
    if (data?.type === 'friend_request' || data?.type === 'request_accepted') {
      router.push('/notifications');
    } else if (data?.type === 'event_invite' && data?.event_id) {
      router.push(`/event/${data.event_id}`);
    } else if (data?.type === 'dm' && data?.channel_id) {
      // DM channel_id format: dm_user1_user2 — extract the other user's ID
      const parts = (data.channel_id as string).replace('dm_', '').split('_');
      const otherUserId = parts.find((p: string) => p !== data.sender_id) ?? parts[0];
      router.push(`/dm/${otherUserId}`);
    } else {
      // Default: open notifications screen
      router.push('/notifications');
    }
  });
}

// ── Get last notification on cold start ──────────────────────────────────────
export async function handleInitialNotification(): Promise<void> {
  const lastResponse = await Notifications.getLastNotificationResponseAsync();
  if (!lastResponse) return;

  // Small delay to let navigation mount
  setTimeout(() => {
    const data = lastResponse.notification.request.content.data;
    if (data?.type === 'event_invite' && data?.event_id) {
      router.push(`/event/${data.event_id}`);
    } else if (data?.type === 'dm' && data?.channel_id) {
      const parts = (data.channel_id as string).replace('dm_', '').split('_');
      const otherUserId = parts.find((p: string) => p !== data.sender_id) ?? parts[0];
      router.push(`/dm/${otherUserId}`);
    } else {
      router.push('/notifications');
    }
  }, 500);
}
