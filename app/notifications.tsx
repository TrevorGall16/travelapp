import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, ChevronLeft } from 'lucide-react-native';
import { Colors } from '../constants/theme';

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.flex}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.5} />
          <Text style={styles.backLabel}>Map</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerRight} />
      </View>

      {/* ── Empty state ── */}
      <View style={styles.emptyState}>
        <View style={styles.iconWrap}>
          <Bell size={36} color={Colors.textTertiary} strokeWidth={1.5} />
        </View>
        <Text style={styles.emptyTitle}>Nothing right now</Text>
        <Text style={styles.emptyBody}>Come back later!</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Header ──────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backLabel: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerRight: {
    flex: 1,
  },

  // ── Empty state ──────────────────────────────────────────────
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyBody: {
    fontSize: 15,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
