import { StyleSheet, Text, View } from 'react-native';

// Phase 3 — My Events (Tab 2)
// Renders all events the user is participating in (hosted + joined).
// See USER_FLOW.md Flow 6 for full spec.
export default function MyEventsScreen() {
  return (
    <View style={styles.fill}>
      <Text style={styles.placeholder}>My Events — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  placeholder: { color: '#64748B', fontSize: 16 },
});
