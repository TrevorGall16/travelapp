// components/chat/DeleteConfirmModal.tsx

import { Modal, Pressable, Text, View } from 'react-native';
import { styles } from '../../styles/eventChatStyles';

interface DeleteConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({ visible, onClose, onConfirm }: DeleteConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.deleteConfirmOverlay} onPress={onClose} />
      <View style={styles.deleteConfirmCard}>
        <Text style={styles.deleteConfirmTitle}>Delete Event?</Text>
        <Text style={styles.deleteConfirmBody}>
          Are you sure? This cannot be undone.
        </Text>
        <View style={styles.deleteConfirmActions}>
          <Pressable style={styles.deleteConfirmCancelBtn} onPress={onClose}>
            <Text style={styles.deleteConfirmCancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.deleteConfirmDeleteBtn} onPress={onConfirm}>
            <Text style={styles.deleteConfirmDeleteText}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
