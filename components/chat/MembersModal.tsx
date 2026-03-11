// components/chat/MembersModal.tsx

import { useMemo } from 'react';
import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { createStyles } from '../../styles/eventChatStyles';
import { useAppTheme } from '../../constants/theme';

export interface MemberEntry {
  user?: { id?: string; name?: string; image?: string | null };
  user_id?: string;
}

interface MembersModalProps {
  visible: boolean;
  onClose: () => void;
  members: MemberEntry[];
  eventHostId: string | null;
  insetsBottom: number;
  onNavigateToUser: (userId: string) => void;
}

export function MembersModal({
  visible,
  onClose,
  members,
  eventHostId,
  insetsBottom,
  onNavigateToUser,
}: MembersModalProps) {
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
      <View style={[styles.membersSheet, { paddingBottom: insetsBottom + 12 }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.membersTitle}>Event Members</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {members.map((member) => {
            const isThisHost = member.user?.id === eventHostId;
            const avatarUri = member.user?.image as string | undefined;
            const displayName = (member.user?.name as string | undefined) ?? 'Unknown';
            const userId = member.user?.id ?? '';
            return (
              <Pressable
                key={userId || member.user_id}
                style={({ pressed }) => [
                  styles.memberRow,
                  pressed && styles.memberRowPressed,
                ]}
                onPress={() => {
                  onClose();
                  if (userId) onNavigateToUser(userId);
                }}
              >
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.memberAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.memberAvatar, styles.memberAvatarFallback]}>
                    <Text style={styles.memberAvatarEmoji}>👤</Text>
                  </View>
                )}
                <Text style={styles.memberName} numberOfLines={1}>
                  {displayName}
                </Text>
                {isThisHost && (
                  <View style={styles.hostBadge}>
                    <Text style={styles.hostBadgeText}>Host</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}
