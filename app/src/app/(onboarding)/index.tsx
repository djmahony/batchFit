import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ChoiceCard } from '@/components/choice-card';
import { OnboardingStep } from '@/components/onboarding-step';
import { Segmented } from '@/components/segmented';
import { Spacing } from '@/constants/theme';
import { useOnboarding, type RateChoice } from '@/context/onboarding';
import type { Goal } from '@/lib/api';

const GOALS: { value: Goal; title: string; description: string; badge?: string }[] = [
  {
    value: 'lose',
    title: 'Lose weight',
    description: 'Lean down while keeping protein high',
    badge: 'POPULAR',
  },
  { value: 'maintain', title: 'Maintain', description: 'Hold steady, eat with intention' },
  { value: 'build', title: 'Build muscle', description: 'Eat in a surplus, train hard' },
];

const RATES: { label: string; value: RateChoice }[] = [
  { label: 'Gentle', value: 'gentle' },
  { label: 'Moderate', value: 'moderate' },
  { label: 'Aggressive', value: 'aggressive' },
];

// Onboarding step 1 — "What's your goal?" (mockup 1b/2b).
export default function GoalScreen() {
  const { state, update } = useOnboarding();

  return (
    <OnboardingStep
      step={0}
      title="What's your goal?"
      subtitle="We'll tailor your daily targets around it."
      onContinue={() => router.push('/about')}>
      <View style={styles.cards}>
        {GOALS.map((goal) => (
          <ChoiceCard
            key={goal.value}
            title={goal.title}
            description={goal.description}
            badge={goal.badge}
            selected={state.goal === goal.value}
            onPress={() => update({ goal: goal.value })}>
            {goal.value === 'lose' && state.goal === 'lose' ? (
              <Segmented options={RATES} value={state.rate} onChange={(rate) => update({ rate })} />
            ) : null}
          </ChoiceCard>
        ))}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  cards: {
    gap: Spacing.three - 4,
  },
});
