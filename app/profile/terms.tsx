import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Colors } from '../../constants/theme';

const SECTIONS = [
  {
    heading: '1. Acceptance of Terms',
    body: 'By creating an account or using this app, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app.',
  },
  {
    heading: '2. Eligibility',
    body: 'You must be at least 18 years old to use this app. By using the app, you represent that you meet this age requirement.',
  },
  {
    heading: '3. Your Account',
    body: 'You are responsible for maintaining the security of your account credentials. You agree to notify us immediately of any unauthorized access. You may not transfer your account to another person.',
  },
  {
    heading: '4. Community Standards',
    body: 'This is a community for genuine travelers. You agree not to post false information, harass other users, spam events, or engage in any activity that harms the community. We reserve the right to remove content or accounts that violate these standards.',
  },
  {
    heading: '5. Events',
    body: 'Events posted on this platform are user-generated. We do not organize, verify, or take responsibility for events. Always exercise personal judgment and follow local laws when attending or hosting meetups.',
  },
  {
    heading: '6. Intellectual Property',
    body: 'You retain ownership of content you post. By posting, you grant us a non-exclusive, royalty-free license to display that content within the app. You may not copy or redistribute our own content or design.',
  },
  {
    heading: '7. Termination',
    body: 'We may suspend or terminate your account if you violate these terms. You may delete your account at any time via the Settings screen.',
  },
  {
    heading: '8. Limitation of Liability',
    body: 'This app is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the app.',
  },
  {
    heading: '9. Changes to Terms',
    body: 'We may update these Terms of Service from time to time. Continued use of the app after changes constitutes your acceptance of the new terms.',
  },
  {
    heading: '10. Contact',
    body: 'Questions about these terms? Reach us at support@nomadmeet.app.',
  },
] as const;

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.flex}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.5} />
          <Text style={styles.backLabel}>Settings</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last updated: March 1, 2026</Text>

        <View style={styles.card}>
          <Text style={styles.intro}>
            These Terms of Service govern your use of this mobile application. Please read them carefully before using the app.
          </Text>
        </View>

        {SECTIONS.map(section => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
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

  // ── Scroll ──────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
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
