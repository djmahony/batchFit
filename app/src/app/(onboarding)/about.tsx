import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ChoiceCard } from '@/components/choice-card';
import { OnboardingStep } from '@/components/onboarding-step';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { num, useOnboarding, type OnboardingState } from '@/context/onboarding';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityLevel, Sex, Units } from '@/lib/api';

const ACTIVITY_LEVELS: { value: ActivityLevel; title: string; description: string }[] = [
  { value: 'sedentary', title: 'Sedentary', description: 'Desk days, little planned exercise' },
  { value: 'light', title: 'Lightly active', description: 'On your feet a bit, 1–3 workouts a week' },
  { value: 'moderate', title: 'Moderately active', description: 'Training 3–5 days a week' },
  { value: 'active', title: 'Active', description: 'Training hard 6–7 days a week' },
  { value: 'very_active', title: 'Very active', description: 'Hard training plus a physical job' },
];

const CM_PER_IN = 2.54;
const KG_PER_LB = 0.45359237;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Convert the typed height/weight when the unit system changes, keeping what's entered. */
function convertUnits(state: OnboardingState, units: Units): Partial<OnboardingState> {
  if (units === state.units) return {};
  const patch: Partial<OnboardingState> = { units };

  const weight = num(state.weight);
  if (weight > 0) {
    patch.weight = String(round1(units === 'imperial' ? weight / KG_PER_LB : weight * KG_PER_LB));
  }

  if (units === 'imperial') {
    const cm = num(state.heightCm);
    if (cm > 0) {
      const totalIn = Math.round(cm / CM_PER_IN);
      patch.heightFt = String(Math.floor(totalIn / 12));
      patch.heightIn = String(totalIn % 12);
    }
  } else {
    const totalIn = (num(state.heightFt) || 0) * 12 + (num(state.heightIn) || 0);
    if (totalIn > 0) patch.heightCm = String(Math.round(totalIn * CM_PER_IN));
  }
  return patch;
}

// Onboarding step 2 — "About you" (mockup 1c/2c). Feeds the TDEE calculation.
export default function AboutScreen() {
  const theme = useTheme();
  const { state, update } = useOnboarding();
  const [error, setError] = useState<string | null>(null);

  const metric = state.units === 'metric';

  const onContinue = () => {
    setError(null);
    const age = num(state.age);
    if (!(age >= 13 && age <= 120)) {
      setError('Age needs to be between 13 and 120.');
      return;
    }
    const heightOk = metric
      ? num(state.heightCm) > 0
      : (num(state.heightFt) || 0) * 12 + (num(state.heightIn) || 0) > 0;
    if (!heightOk) {
      setError('Add your height so we can size your targets.');
      return;
    }
    if (!(num(state.weight) > 0)) {
      setError('Add your current weight so we can size your targets.');
      return;
    }
    router.push('/targets');
  };

  return (
    <OnboardingStep
      step={1}
      title="About you"
      subtitle="Used to estimate your daily energy needs."
      onContinue={onContinue}
      error={error}>
      <Segmented<Units>
        options={[
          { label: 'Metric', value: 'metric' },
          { label: 'Imperial', value: 'imperial' },
        ]}
        value={state.units}
        onChange={(units) => update(convertUnits(state, units))}
      />

      <View style={styles.sexRow}>
        {(
          [
            { label: 'Male', value: 'male' },
            { label: 'Female', value: 'female' },
          ] as { label: string; value: Sex }[]
        ).map((option) => {
          const selected = state.sex === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => update({ sex: option.value })}
              style={[
                styles.sexOption,
                selected
                  ? { backgroundColor: theme.ink }
                  : { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.surfaceBorder },
              ]}>
              <ThemedText
                style={[
                  styles.sexLabel,
                  selected ? { color: theme.onInk, fontFamily: Fonts.bodyBold } : null,
                ]}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <InputRow label="Age" value={state.age} onChangeText={(age) => update({ age })} unit="years" />
      {metric ? (
        <InputRow
          label="Height"
          value={state.heightCm}
          onChangeText={(heightCm) => update({ heightCm })}
          unit="cm"
        />
      ) : (
        <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
            Height
          </ThemedText>
          <View style={styles.rowValue}>
            <ValueInput value={state.heightFt} onChangeText={(heightFt) => update({ heightFt })} />
            <ThemedText style={[styles.unit, { color: theme.textMuted }]}>ft</ThemedText>
            <ValueInput value={state.heightIn} onChangeText={(heightIn) => update({ heightIn })} />
            <ThemedText style={[styles.unit, { color: theme.textMuted }]}>in</ThemedText>
          </View>
        </View>
      )}
      <InputRow
        label="Current weight"
        value={state.weight}
        onChangeText={(weight) => update({ weight })}
        unit={metric ? 'kg' : 'lb'}
      />

      <ThemedText type="smallBold" style={styles.sectionLabel}>
        Activity level
      </ThemedText>
      <View style={styles.cards}>
        {ACTIVITY_LEVELS.map((level) => (
          <ChoiceCard
            key={level.value}
            title={level.title}
            description={level.description}
            selected={state.activityLevel === level.value}
            onPress={() => update({ activityLevel: level.value })}
          />
        ))}
      </View>
    </OnboardingStep>
  );
}

function ValueInput({ value, onChangeText }: { value: string; onChangeText: (t: string) => void }) {
  const theme = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      keyboardType="decimal-pad"
      placeholder="—"
      placeholderTextColor={theme.textMuted}
      style={[styles.input, { color: theme.text }]}
    />
  );
}

function InputRow({
  label,
  value,
  onChangeText,
  unit,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  unit: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
        {label}
      </ThemedText>
      <View style={styles.rowValue}>
        <ValueInput value={value} onChangeText={onChangeText} />
        <ThemedText style={[styles.unit, { color: theme.textMuted }]}>{unit}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sexRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 13,
  },
  sexOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 12,
  },
  sexLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: Spacing.three,
    marginTop: 10,
    minHeight: 52,
  },
  rowLabel: {
    fontFamily: Fonts.bodySemibold,
  },
  rowValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  input: {
    fontFamily: Fonts.display,
    fontSize: 18,
    textAlign: 'right',
    minWidth: 52,
    paddingVertical: 4,
  },
  unit: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
  },
  sectionLabel: {
    marginTop: 18,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  cards: {
    gap: 10,
  },
});
