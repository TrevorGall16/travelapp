// components/chat/OptionsModal.tsx

import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { styles } from '../../styles/eventChatStyles';

interface OptionsModalProps {
  visible: boolean;
  onClose: () => void;
  isHost: boolean;
  isParticipant: boolean;
  insetsBottom: number;
  onSetMeetupPoint: () => void;
  onDeleteEvent: () => void;
  onLeaveEvent: () => void;
}

export function OptionsModal({
  visible,
  onClose,
  isHost,
  isParticipant,
  insetsBottom,
  onSetMeetupPoint,
  onDeleteEvent,
  onLeaveEvent,
}: OptionsModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetOverlay} onPress={onClose} />
      <View style={[styles.optionsSheet, { paddingBottom: insetsBottom + 8 }]}>
        <View style={styles.sheetHandle} />

        {isHost ? (
          <>
            <Pressable
              style={styles.optionRow}
              onPress={() => {
                onClose();
                setTimeout(onSetMeetupPoint, 350);
              }}
            >
              <Text style={styles.optionText}>Edit Meetup Point</Text>
            </Pressable>
            <View style={styles.optionDivider} />

            <Pressable
              style={styles.optionRow}
              onPress={() => {
                onClose();
                console.log('Open Map Edit');
              }}
            >
              <Text style={styles.optionText}>Edit Pin Location</Text>
            </Pressable>
            <View style={styles.optionDivider} />

            <Pressable
              style={styles.optionRow}
              onPress={() => {
                onClose();
                // Delay so modal finishes closing before Alert opens
                setTimeout(onDeleteEvent, 300);
              }}
            >
              <Text style={[styles.optionText, styles.optionDestructive]}>
                Delete Event
              </Text>
            </Pressable>
            <View style={styles.optionDivider} />
          </>
        ) : (
          <>
            {isParticipant && (
              <>
                <Pressable
                  style={styles.optionRow}
                  onPress={() => {
                    onClose();
                    setTimeout(onLeaveEvent, 300);
                  }}
                >
                  <Text style={[styles.optionText, styles.optionDestructive]}>
                    Leave Event
                  </Text>
                </Pressable>
                <View style={styles.optionDivider} />
              </>
            )}

            <Pressable
              style={styles.optionRow}
              onPress={() => {
                onClose();
                Alert.alert('Reported', 'Thanks — this event has been flagged for review.');
              }}
            >
              <Text style={[styles.optionText, styles.optionDestructive]}>
                Report Event
              </Text>
            </Pressable>
            <View style={styles.optionDivider} />
          </>
        )}

        <Pressable style={styles.optionRow} onPress={onClose}>
          <Text style={styles.optionText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
