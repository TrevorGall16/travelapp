// components/chat/MeetupBanner.tsx

import { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../constants/theme';
import { createBannerStyles } from '../../styles/eventChatStyles';

export interface MeetupPoint {
  label: string;
}

interface MeetupBannerProps {
  meetupPoint: MeetupPoint | null;
  isHost?: boolean;
  onSetMeetupPoint?: () => void;
}

export function MeetupBanner({ meetupPoint, isHost, onSetMeetupPoint }: MeetupBannerProps) {
  const { colors } = useAppTheme();
  const bannerStyles = useMemo(() => createBannerStyles(colors), [colors]);

  return (
    <View style={bannerStyles.container}>
      <Text style={bannerStyles.pin}>📍</Text>
      <View style={bannerStyles.info}>
        {meetupPoint ? (
          <Text style={bannerStyles.label} numberOfLines={1}>
            {meetupPoint.label}
          </Text>
        ) : isHost ? (
          <TouchableOpacity onPress={onSetMeetupPoint} activeOpacity={0.7}>
            <Text style={bannerStyles.noPoint}>No meetup point yet</Text>
            <Text style={bannerStyles.noPointHint}>Tap to set one</Text>
          </TouchableOpacity>
        ) : (
          <Text style={bannerStyles.noPoint}>No meetup point yet</Text>
        )}
      </View>
    </View>
  );
}
