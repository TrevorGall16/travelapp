import { StyleSheet, Text, View } from 'react-native';

// Phase 3 — Profile (Tab 3)
// Displays own profile, Edit Profile, Settings navigation.
// See USER_FLOW.md Flow 8 for full spec.
export default function ProfileScreen() {
  return (
    <View style={styles.fill}>
      <Text style={styles.placeholder}>Profile — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  placeholder: { color: '#64748B', fontSize: 16 },
});
