import { Stack } from 'expo-router';

// Auth flow (Welcome -> Register / Login). Shown only while logged out; the
// root layout guards this group and redirects into the app once authenticated.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
