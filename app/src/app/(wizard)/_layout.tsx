import { Stack } from 'expo-router';

import { BatchDraftProvider } from '@/context/batch-draft';

// The New batch wizard (mockups 1m→1q): one modal, four steps + confirmation,
// sharing a draft via BatchDraftProvider.
export default function WizardLayout() {
  return (
    <BatchDraftProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </BatchDraftProvider>
  );
}
