import { Stack } from 'expo-router';

// Settings and its sub-screens (Goals & targets, Profile, TDEE calculator).
export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
