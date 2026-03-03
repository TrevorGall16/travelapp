// styles/setupStyles.ts — Styles extracted from app/(auth)/setup.tsx

import { StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';

export const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
    gap: 8,
  },
  backText: {
    fontSize: 16,
    color: Colors.accent,
    marginBottom: 8,
  },
  headerCenter: {
    gap: 6,
  },
  stepIndicator: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textTertiary,
    lineHeight: 22,
  },
  form: {
    gap: 20,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  avatarPlaceholderIcon: {
    fontSize: 24,
  },
  avatarPlaceholderText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  avatarHint: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  avatarEditBadgeText: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: '600',
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputError: {
    borderColor: Colors.error,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  inputMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  charCountRight: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'right',
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: Colors.textTertiary,
  },
  countryFlag: {
    fontSize: 22,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  chevron: {
    fontSize: 20,
    color: Colors.textTertiary,
  },
  igRow: {
    flexDirection: 'row',
  },
  igPrefix: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRightWidth: 0,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  igPrefixText: {
    fontSize: 18,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  igInput: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipButtonText: {
    fontSize: 15,
    color: Colors.textTertiary,
  },
});
