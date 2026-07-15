import { Stack } from 'expo-router';

import { OnboardingProvider } from '@/context/onboarding';

// Onboarding flow (Goal -> About you -> Targets). Shown only to a logged-in
// user who hasn't completed onboarding; the root layout guards this group and
// swaps to the tabs once PUT /me/profile sets onboardingComplete.
export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingProvider>
  );
}
