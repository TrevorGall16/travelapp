import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    // This tells Supabase to kill the session and clears local storage
    await supabase.auth.signOut();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Profile</Text>
      
      <View style={styles.card}>
        <Text style={styles.label}>Logged in as:</Text>
        <Text style={styles.value}>{profile?.display_name || 'No Name Set'}</Text>
        <Text style={styles.value}>@{profile?.username || 'unknown'}</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#0F172A', marginBottom: 20 },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 12, marginBottom: 30 },
  label: { fontSize: 14, color: '#64748B', marginBottom: 4 },
  value: { fontSize: 18, color: '#0F172A', fontWeight: '500', marginBottom: 8 },
  logoutButton: { backgroundColor: '#EF4444', padding: 16, borderRadius: 12, alignItems: 'center' },
  logoutText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});