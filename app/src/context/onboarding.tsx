import { createContext, useContext, useState, type ReactNode } from 'react';

import type { ActivityLevel, Goal, Sex, Units } from '@/lib/api';

export type RateChoice = 'gentle' | 'moderate' | 'aggressive';

/** Weekly kg per rate choice — sizes the calorie deficit (lose) or surplus (build). */
export const RATE_KG_PER_WK: Record<RateChoice, number> = {
  gentle: 0.25,
  moderate: 0.5,
  aggressive: 0.75,
};

/**
 * Everything the onboarding steps collect, held in memory until the final
 * "Looks good" saves it via PUT /me/profile. Numeric fields are the raw
 * text-field values, in whichever units are currently selected.
 */
export type OnboardingState = {
  goal: Goal;
  rate: RateChoice;
  units: Units;
  sex: Sex;
  age: string;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weight: string;
  activityLevel: ActivityLevel;
};

const initialState: OnboardingState = {
  goal: 'lose',
  rate: 'moderate',
  units: 'metric',
  sex: 'male',
  age: '',
  heightCm: '',
  heightFt: '',
  heightIn: '',
  weight: '',
  activityLevel: 'light',
};

type OnboardingContextValue = {
  state: OnboardingState;
  update: (patch: Partial<OnboardingState>) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const update = (patch: Partial<OnboardingState>) => setState((s) => ({ ...s, ...patch }));
  return (
    <OnboardingContext.Provider value={{ state, update }}>{children}</OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return ctx;
}

/** Parse a user-typed number, accepting a comma decimal separator. */
export const num = (text: string): number => parseFloat(text.replace(',', '.'));

const CM_PER_IN = 2.54;
const KG_PER_LB = 0.45359237;

/** Height in cm from the current fields (converting from ft/in when imperial). */
export function heightCmFrom(state: OnboardingState): number {
  if (state.units === 'metric') return num(state.heightCm);
  return (num(state.heightFt) || 0) * 12 * CM_PER_IN + (num(state.heightIn) || 0) * CM_PER_IN;
}

/** Weight in kg from the current fields (converting from lb when imperial). */
export function weightKgFrom(state: OnboardingState): number {
  const value = num(state.weight);
  return state.units === 'metric' ? value : value * KG_PER_LB;
}

/**
 * The API stores a birth date and derives age from it, but onboarding asks for
 * age (per the spec) — so anchor the birth date `age` years before today.
 */
export function birthDateFrom(state: OnboardingState): string {
  const now = new Date();
  const birth = new Date(Date.UTC(now.getUTCFullYear() - num(state.age), now.getUTCMonth(), 1));
  return birth.toISOString().slice(0, 10);
}

/**
 * Weekly rate for the API: the chosen rate for lose; a fixed gentle surplus for
 * build (the rate selector is only shown for weight loss); none for maintain.
 */
export function goalRateFrom(state: OnboardingState): number | undefined {
  if (state.goal === 'maintain') return undefined;
  if (state.goal === 'build') return RATE_KG_PER_WK.gentle;
  return RATE_KG_PER_WK[state.rate];
}
