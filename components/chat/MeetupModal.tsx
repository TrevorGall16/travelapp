// components/chat/MeetupModal.tsx

import { useRef } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors } from '../../constants/theme';
import { styles } from '../../styles/eventChatStyles';

interface MeetupModalProps {
  visible: boolean;
  onClose: () => void;
  meetupDraft: string;
  setMeetupDraft: (val: string) => void;
  onSave: (label: string) => void;
  isSettingMeetup: boolean;
  insetsBottom: number;
}

export function MeetupModal({
  visible,
  onClose,
  meetupDraft,
  setMeetupDraft,
  onSave,
  isSettingMeetup,
  insetsBottom,
}: MeetupModalProps) {
  const inputRef = useRef<TextInput>(null);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => inputRef.current?.focus()}
    >
      {/*
       * KAV wraps the whole modal so the sheet slides up with the keyboard.
       * The backdrop Pressable sits inside it at absoluteFill so tapping
       * outside the sheet dismisses the modal.
       */}
      <KeyboardAvoidingView
        style={styles.meetupKAV}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[styles.meetupSheet, { paddingBottom: insetsBottom + 20 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.meetupSheetTitle}>Set Meetup Point</Text>
          <Text style={styles.meetupSheetSubtitle}>
            Describe where the group should meet up.
          </Text>
          <TextInput
            ref={inputRef}
            style={styles.meetupInput}
            value={meetupDraft}
            onChangeText={setMeetupDraft}
            placeholder="e.g. Front entrance of the café"
            placeholderTextColor={Colors.textTertiary}
            maxLength={100}
          />
          <View style={styles.meetupActions}>
            <Pressable style={styles.meetupCancelBtn} onPress={onClose}>
              <Text style={styles.meetupCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.meetupConfirmBtn,
                isSettingMeetup && styles.meetupConfirmBtnDisabled,
              ]}
              onPress={() => onSave(meetupDraft)}
              disabled={isSettingMeetup}
            >
              <Text style={styles.meetupConfirmText}>
                {isSettingMeetup ? 'Saving…' : 'Set'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
