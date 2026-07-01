import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

// The five-tab bottom bar is the app's backbone (see mvp-spec.md §0.1).
// Prep is the signature differentiator and sits centrally.
const tabs: { name: string; title: string; icon: IoniconName }[] = [
  { name: 'index', title: 'Today', icon: 'today-outline' },
  { name: 'diary', title: 'Diary', icon: 'book-outline' },
  { name: 'prep', title: 'Prep', icon: 'restaurant-outline' },
  { name: 'train', title: 'Train', icon: 'barbell-outline' },
  { name: 'progress', title: 'Progress', icon: 'trending-up-outline' },
];

export default function TabsLayout() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background },
      }}>
      {tabs.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, size }) => <Ionicons name={icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
