import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';

export default function SplashScreen() {
  const router = useRouter();
  // Read from the persisted store so we skip the login screen
  // when the user already has a valid cached session.
  const { user, profile } = useAuthStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (user && profile) {
        router.replace('/(tabs)/');
      } else {
        router.replace('/(auth)/');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [router, user, profile]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>NomadMeet</Text>
      <Text style={styles.tagline}>Meet travelers, not tourists</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logo: {
    fontSize: 40,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    color: '#64748B',
  },
});
