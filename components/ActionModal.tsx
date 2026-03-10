import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme, Radius, Spacing } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';

interface ActionModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions: Array<{
    label: string;
    destructive?: boolean;
    onPress: () => void;
  }>;
}

export function ActionModal({ visible, onClose, title, subtitle, actions }: ActionModalProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createLocalStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.card}>
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}

          <View style={s.divider} />

          {actions.map((action, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [s.actionBtn, pressed && s.actionPressed]}
              onPress={action.onPress}
            >
              <Text style={[s.actionText, action.destructive && s.actionDestructive]}>
                {action.label}
              </Text>
            </Pressable>
          ))}

          <View style={s.divider} />

          <Pressable
            style={({ pressed }) => [s.actionBtn, pressed && s.actionPressed]}
            onPress={onClose}
          >
            <Text style={s.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel?: string;
}

export function ConfirmModal({ visible, onClose, onConfirm, title, body, confirmLabel = 'Delete' }: ConfirmModalProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createLocalStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.card}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.subtitle}>{body}</Text>

          <View style={s.confirmActions}>
            <Pressable
              style={({ pressed }) => [s.confirmBtn, s.confirmCancel, pressed && s.actionPressed]}
              onPress={onClose}
            >
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.confirmBtn, s.confirmDelete, pressed && s.confirmDeletePressed]}
              onPress={onConfirm}
            >
              <Text style={s.confirmDeleteText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createLocalStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  actionPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  actionDestructive: {
    color: colors.error,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  confirmCancel: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmDelete: {
    backgroundColor: colors.error,
  },
  confirmDeletePressed: {
    backgroundColor: colors.error,
    opacity: 0.8,
  },
  confirmDeleteText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
});
