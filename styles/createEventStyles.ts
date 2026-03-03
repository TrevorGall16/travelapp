// styles/createEventStyles.ts — Styles extracted from app/event/create.tsx

import { Platform, StyleSheet } from 'react-native';

export const ELECTRIC_BLUE = '#3B82F6';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  flex: {
    flex: 1,
  },

  // Header — paddingTop is applied inline via useSafeAreaInsets
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  // top is applied inline
  closeBtn: {
    position: 'absolute',
    right: 20,
    padding: 4,
  },

  // Scroll content
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 24,
  },

  // Field group
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelOptional: {
    fontWeight: '400',
    textTransform: 'none',
    color: '#475569',
  },

  // Inputs
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputError: {
    borderColor: '#EF4444',
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
    color: '#475569',
  },
  charCountRight: {
    textAlign: 'right',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
  },

  // Category chips — 3 per row
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
    minWidth: '30%',
  },
  chipSelected: {
    backgroundColor: '#1D3E6E',
    borderColor: ELECTRIC_BLUE,
  },
  chipEmoji: {
    fontSize: 18,
  },
  chipLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  chipLabelSelected: {
    color: '#F8FAFC',
  },

  // Location picker
  locationHint: {
    fontSize: 13,
    color: '#64748B',
    marginTop: -2,
  },
  mapPickerContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  mapPicker: {
    height: 250,
  },
  mapPlaceholder: {
    height: 120,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  mapPlaceholderText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Datetime picker row
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  dateRowIcon: {
    fontSize: 18,
  },
  dateRowText: {
    flex: 1,
    fontSize: 16,
    color: '#F8FAFC',
    fontWeight: '500',
  },
  dateRowChevron: {
    fontSize: 22,
    color: '#475569',
    lineHeight: 24,
  },
  datePickerDoneBtn: {
    backgroundColor: ELECTRIC_BLUE,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  datePickerDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // Verified toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
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
    color: '#F8FAFC',
  },
  toggleSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },

  // Publish button
  publishBtn: {
    backgroundColor: ELECTRIC_BLUE,
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: ELECTRIC_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  publishBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 48 : 32,
    alignSelf: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
    textAlign: 'center',
  },
});
