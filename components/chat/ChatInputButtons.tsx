// components/chat/ChatInputButtons.tsx
// Custom InputButtons: inline Photo, Camera, and Poll icons in the message input bar.
// Replaces the default single-attach-button UX with quick-access individual buttons.

import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Image, Camera, BarChart3 } from 'lucide-react-native';
import {
  useMessageInputContext,
  useMessagesContext,
  useChannelContext,
} from 'stream-chat-expo';

import { useAppTheme } from '../../constants/theme';
import type { ThemeColors } from '../../constants/theme';

export function ChatInputButtons() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createLocalStyles(colors), [colors]);
  const {
    pickAndUploadImageFromNativePicker,
    takeAndUploadImage,
    openPollCreationDialog,
    sendMessage,
  } = useMessageInputContext();
  const { hasCreatePoll } = useMessagesContext();
  const { threadList } = useChannelContext();

  const showPoll = hasCreatePoll && !threadList;

  return (
    <View style={s.row}>
      <Pressable
        onPress={pickAndUploadImageFromNativePicker}
        style={({ pressed }) => [s.btn, pressed && s.pressed]}
        hitSlop={6}
      >
        <Image size={20} color={colors.textTertiary} />
      </Pressable>

      <Pressable
        onPress={() => takeAndUploadImage(Platform.OS === 'android' ? 'image' : 'mixed')}
        style={({ pressed }) => [s.btn, pressed && s.pressed]}
        hitSlop={6}
      >
        <Camera size={20} color={colors.textTertiary} />
      </Pressable>

      {showPoll && (
        <Pressable
          onPress={() => openPollCreationDialog?.({ sendMessage })}
          style={({ pressed }) => [s.btn, pressed && s.pressed]}
          hitSlop={6}
        >
          <BarChart3 size={20} color={colors.textTertiary} />
        </Pressable>
      )}
    </View>
  );
}

const createLocalStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: 4,
  },
  btn: {
    padding: 6,
    borderRadius: 8,
  },
  pressed: {
    backgroundColor: colors.surfaceElevated,
  },
});
