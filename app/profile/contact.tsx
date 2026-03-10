import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useAppTheme } from '../../constants/theme';
import type { ThemeColors } from '../../constants/theme';

const createLocalStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header ──────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
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
    paddingBottom: 20,
    gap: 16,
  },

  // ── Cards ────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bodyText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 23,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  emailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emailAddress: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.accent,
  },

  // ── Footnote ─────────────────────────────────────────────────
  footnote: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
    marginTop: 8,
  },
});

export default function ContactScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createLocalStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.flex}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={20} color={colors.textPrimary} strokeWidth={2.5} />
          <Text style={styles.backLabel}>Settings</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Us</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Support card ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Get in Touch</Text>
          <Text style={styles.bodyText}>
            Have a question, found a bug, or need help with your account? Our support team is here for you.
          </Text>
          <Text style={styles.bodyText}>
            We aim to respond to all messages within 24 hours on business days.
          </Text>
          <View style={styles.emailRow}>
            <Text style={styles.emailLabel}>Email</Text>
            <Text style={styles.emailAddress}>support@nomadmeet.app</Text>
          </View>
        </View>

        {/* ── Report abuse card ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Report Abuse</Text>
          <Text style={styles.bodyText}>
            If you need to report harmful content, harassment, or a safety concern, please contact us directly and we will prioritize your request.
          </Text>
          <View style={styles.emailRow}>
            <Text style={styles.emailLabel}>Email</Text>
            <Text style={styles.emailAddress}>safety@nomadmeet.app</Text>
          </View>
        </View>

        {/* ── Response time notice ── */}
        <Text style={styles.footnote}>
          We are a small team. We read every message and will get back to you as soon as we can.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
