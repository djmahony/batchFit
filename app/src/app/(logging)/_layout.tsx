import { Stack } from 'expo-router';

// The Add Food flow: one modal presented from a meal's "Add food" row, with its
// own stack so search → food detail → create food push within the sheet.
export default function LoggingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
