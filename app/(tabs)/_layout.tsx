import { Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Map, CalendarCheck, User } from 'lucide-react-native';

const ELECTRIC_BLUE = '#3B82F6';
const INACTIVE = '#64748B';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: ELECTRIC_BLUE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => <Map color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="my-events"
        options={{
          title: 'My Events',
          tabBarIcon: ({ color, size }) => (
            <CalendarCheck color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0F172A',
    borderTopColor: '#1E293B',
    borderTopWidth: StyleSheet.hairlineWidth,
    height: Platform.OS === 'ios' ? 88 : 72,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
