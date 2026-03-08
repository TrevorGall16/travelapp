import { Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Map, CalendarCheck, MessageCircle, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';

/** Content-area height of the tab bar (excluding safe area). */
export const TAB_CONTENT_HEIGHT = 56;

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // Consistent tab bar height: content area + safe area bottom
  const tabBarHeight = TAB_CONTENT_HEIGHT + (Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : insets.bottom + 8);
  const tabBarPaddingBottom = Platform.OS === 'ios' ? Math.max(insets.bottom - 8, 8) : insets.bottom + 4;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 6,
          // Subtle elevation on both platforms
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
            },
            android: {
              elevation: 8,
            },
          }),
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => <Map color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="my-events"
        options={{
          title: 'My Events',
          tabBarIcon: ({ color, size }) => (
            <CalendarCheck color={color} size={size} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <MessageCircle color={color} size={size} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
