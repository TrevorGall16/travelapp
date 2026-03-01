import { router } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Colors } from '../../constants/theme';

const MENU_ITEMS = [
  { label: 'Contact Us', route: '/profile/contact' },
  { label: 'Privacy Policy', route: '/profile/privacy' },
  { label: 'Terms of Service', route: '/profile/terms' },
] as const;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.flex}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.5} />
          <Text style={styles.backLabel}>Profile</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === 'android' ? 100 : insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Menu ── */}
        <View style={styles.menuCard}>
          {MENU_ITEMS.flatMap((item, i) => [
            i > 0 ? <View key={`divider-${i}`} style={styles.menuDivider} /> : null,
            <TouchableOpacity
              key={item.label}
              style={styles.menuRow}
              onPress={() => router.push(item.route)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuLabel}>{item.label}</Text>
              <ChevronRight size={18} color={Colors.textTertiary} strokeWidth={2} />
            </TouchableOpacity>,
          ])}
        </View>

        {/* ── Danger Zone ── */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerSectionLabel}>Danger Zone</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => console.log('Delete Account')}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
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

  // ── Scroll ──────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 32,
  },

  // ── Menu card ────────────────────────────────────────────────
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
  },

  // ── Danger Zone ──────────────────────────────────────────────
  dangerSection: {
    gap: 12,
  },
  dangerSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  deleteButton: {
    backgroundColor: Colors.errorBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    paddingVertical: 18,
    alignItems: 'center',
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.errorLight,
  },
});
