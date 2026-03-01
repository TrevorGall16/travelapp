import { router } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Colors } from '../../constants/theme';

const SECTIONS = [
  {
    heading: '1. Information We Collect',
    body: 'We collect information you provide directly to us, such as your name, profile photo, country of origin, bio, and Instagram handle. We also collect location data while the app is in use to show you nearby events and other travelers.',
  },
  {
    heading: '2. How We Use Your Information',
    body: 'We use your information to operate and improve NomadMeet, personalize your experience, connect you with other travelers, send you relevant notifications, and ensure the safety of our community.',
  },
  {
    heading: '3. Information Sharing',
    body: 'We do not sell your personal data. Your public profile (name, photo, bio, country) is visible to other NomadMeet users. We share data with trusted service providers — including Supabase (database), Stream (chat), and RevenueCat (purchases) — solely to operate the app.',
  },
  {
    heading: '4. Location Data',
    body: 'Location is used only while the app is actively in use (foreground). We do not track your location in the background. Location is used to display nearby events on the map and is not stored permanently on our servers.',
  },
  {
    heading: '5. Data Retention',
    body: 'You may delete your account at any time. Upon deletion, your profile, events, and chat messages are permanently removed from our systems within 30 days.',
  },
  {
    heading: '6. Contact',
    body: 'If you have questions about this Privacy Policy, please contact us at support@nomadmeet.app.',
  },
] as const;

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.flex}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.5} />
          <Text style={styles.backLabel}>Settings</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === 'android' ? 100 : insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last updated: March 1, 2026</Text>

        <View style={styles.card}>
          <Text style={styles.intro}>
            NomadMeet ("we", "us", or "our") is committed to protecting your privacy. This policy explains how we collect, use, and share information when you use our app.
          </Text>
        </View>

        {SECTIONS.map(section => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
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
    paddingTop: 24,
    gap: 20,
  },

  // ── Metadata ─────────────────────────────────────────────────
  lastUpdated: {
    fontSize: 13,
    color: Colors.textTertiary,
  },

  // ── Intro card ───────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  intro: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
  },

  // ── Sections ─────────────────────────────────────────────────
  section: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionBody: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
});
