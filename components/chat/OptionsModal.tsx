// components/chat/OptionsModal.tsx

import { useMemo } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { createStyles } from '../../styles/eventChatStyles';
import { useAppTheme } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface OptionsModalProps {
  visible: boolean;
  onClose: () => void;
  isHost: boolean;
  isParticipant: boolean;
  insetsBottom: number;
  eventId: string;
  onSetMeetupPoint: () => void;
  onEditPinLocation: () => void;
  onDeleteEvent: () => void;
  onLeaveEvent: () => void;
}

export function OptionsModal({
  visible,
  onClose,
  isHost,
  isParticipant,
  insetsBottom,
  eventId,
  onSetMeetupPoint,
  onEditPinLocation,
  onDeleteEvent,
  onLeaveEvent,
}: OptionsModalProps) {
  const { user } = useAuthStore();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
                setTimeout(onEditPinLocation, 350);
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
              onPress={async () => {
                onClose();
                if (!user) return;
                try {
                  const { error } = await supabase
                    .from('reports')
                    .insert({
                      reporter_id: user.id,
                      event_id: eventId,
                      reason: 'user_reported',
                    });
                  if (error) throw error;
                  Alert.alert('Reported', 'Thanks — this event has been flagged for review.');
                } catch {
                  Alert.alert('Error', 'Could not submit report. Please try again.');
                }
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
