// styles/createEventStyles.ts — Premium event creation form styles

import { Platform, StyleSheet } from 'react-native';
import { Colors, Radius, Shadows, Spacing } from '../constants/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  closeBtn: {
    position: 'absolute',
    right: Spacing.xl,
    padding: Spacing.xs,
  },

  // Scroll content
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
    paddingBottom: 48,
    gap: Spacing.xxl,
  },

  // Field group
  fieldGroup: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelOptional: {
    fontWeight: '400',
    textTransform: 'none',
    color: Colors.textTertiary,
  },

  // Inputs
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
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
    minHeight: 88,
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
    textAlign: 'right',
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    fontWeight: '500',
  },

  // Category chips
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm + 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: '30%',
  },
  chipSelected: {
    backgroundColor: Colors.accentGlow,
    borderColor: Colors.accent,
  },
  chipEmoji: {
    fontSize: 18,
  },
  chipLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipLabelSelected: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },

  // Location picker
  locationHint: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: -2,
  },
  mapPickerContainer: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mapPicker: {
    height: 250,
  },
  mapPlaceholder: {
    height: 120,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  mapPlaceholderText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Datetime picker row
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm + 2,
  },
  dateRowIcon: {
    fontSize: 18,
  },
  dateRowText: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  dateRowChevron: {
    fontSize: 22,
    color: Colors.textTertiary,
    lineHeight: 24,
  },
  datePickerDoneBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    marginTop: Spacing.xs,
    ...Shadows.accentGlow,
  },
  datePickerDoneBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },

  // Verified toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  toggleRowDisabled: {
    opacity: 0.5,
  },
  toggleTextGroup: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  toggleSubtitle: {
    fontSize: 13,
    color: Colors.textTertiary,
    lineHeight: 18,
  },

  // Publish button — premium CTA
  publishBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    ...Shadows.accentGlow,
  },
  btnDisabled: {
    opacity: 0.45,
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  publishBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.3,
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 48 : 32,
    alignSelf: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.medium,
  },
  toastText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
});
