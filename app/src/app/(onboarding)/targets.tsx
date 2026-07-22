import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { OnboardingStep } from '@/components/onboarding-step';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing, type ThemeColor } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { birthDateFrom, goalRateFrom, heightCmFrom, num, useOnboarding, weightKgFrom } from '@/context/onboarding';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';

type Targets = { kcal: string; protein: string; carbs: string; fat: string; fibre: string };

// Onboarding step 3 — "Your daily targets" (mockup 1d/2d). Fetches the TDEE
// suggestion, lets the user override any value, and saves the whole profile.
export default function TargetsScreen() {
  const theme = useTheme();
  const { state } = useOnboarding();
  const { token, updateUser } = useAuth();

  const [targets, setTargets] = useState<Targets | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const kcalInputRef = useRef<TextInput>(null);
  const fibreInputRef = useRef<TextInput>(null);

  const fetchTargets = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.tdee(token, {
        sex: state.sex,
        birthDate: birthDateFrom(state),
        heightCm: heightCmFrom(state),
        weightKg: weightKgFrom(state),
        activityLevel: state.activityLevel,
        goal: state.goal,
        goalRateKgPerWk: goalRateFrom(state),
      });
      setTargets({
        kcal: String(res.targets.kcal),
        protein: String(res.targets.protein),
        carbs: String(res.targets.carbs),
        fat: String(res.targets.fat),
        fibre: String(res.targets.fibre),
      });
    } catch (e) {
      setFetchError(
        e instanceof ApiError ? e.message : 'Something went wrong. Please try again.',
      );
    }
  }, [token, state]);

  // Fetch once on mount; the inputs feeding it can't change while this screen is
  // up. State is only set after the response arrives, not synchronously.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchTargets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryFetch = () => {
    setFetchError(null);
    void fetchTargets();
  };

  const setTarget = (key: keyof Targets) => (value: string) =>
    setTargets((t) => (t ? { ...t, [key]: value } : t));

  const onSave = async () => {
    if (!targets || !token) return;
    setError(null);

    const parsed = {
      targetKcal: num(targets.kcal),
      targetProtein: num(targets.protein),
      targetCarbs: num(targets.carbs),
      targetFat: num(targets.fat),
      targetFibre: num(targets.fibre),
    };
    if (Object.values(parsed).some((v) => !(v > 0))) {
      setError('Targets need to be numbers above zero.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.saveProfile(token, {
        sex: state.sex,
        birthDate: birthDateFrom(state),
        heightCm: heightCmFrom(state),
        activityLevel: state.activityLevel,
        goal: state.goal,
        goalRateKgPerWk: goalRateFrom(state),
        currentWeightKg: weightKgFrom(state),
        units: state.units,
        ...parsed,
      });
      // The root guard sees onboardingComplete flip and swaps to the tabs.
      updateUser(res.user);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <OnboardingStep
      step={2}
      title="Your daily targets"
      subtitle="Based on your goal — tweak any time."
      continueLabel={fetchError ? 'Try again' : 'Looks good'}
      onContinue={fetchError ? retryFetch : onSave}
      continueLoading={saving}
      error={error}>
      {targets ? (
        <>
          <View style={[styles.hero, { backgroundColor: theme.heroSurface, borderColor: theme.surfaceBorder }]}>
            <Pressable
              style={[styles.ring, { borderColor: theme.tint }]}
              onPress={() => kcalInputRef.current?.focus()}>
              <TextInput
                ref={kcalInputRef}
                value={targets.kcal}
                onChangeText={setTarget('kcal')}
                keyboardType="number-pad"
                style={[styles.kcalInput, { color: theme.onHero }]}
              />
              <ThemedText style={[styles.kcalLabel, { color: theme.onHeroMuted }]}>
                KCAL / DAY
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.macroRow}>
            <MacroCard label="Protein" dot="tint" value={targets.protein} onChangeText={setTarget('protein')} />
            <MacroCard label="Carbs" dot="accent" value={targets.carbs} onChangeText={setTarget('carbs')} />
            <MacroCard label="Fat" dot="macroFat" value={targets.fat} onChangeText={setTarget('fat')} />
          </View>

          <Pressable
            style={[styles.fibreRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
            onPress={() => fibreInputRef.current?.focus()}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.fibreLabel}>
              Fibre
            </ThemedText>
            <View style={styles.fibreValue}>
              <TextInput
                ref={fibreInputRef}
                value={targets.fibre}
                onChangeText={setTarget('fibre')}
                keyboardType="decimal-pad"
                style={[styles.fibreInput, { color: theme.text }]}
              />
              <ThemedText style={[styles.unit, { color: theme.textMuted }]}>g</ThemedText>
            </View>
          </Pressable>

          <View style={[styles.banner, { backgroundColor: theme.tintSoft }]}>
            <View style={[styles.bannerIcon, { backgroundColor: theme.tint }]}>
              <Ionicons name="leaf" size={15} color={theme.onTint} />
            </View>
            <ThemedText style={[styles.bannerText, { color: theme.onTintSoft }]}>
              A couple of batch cooks a week and these mostly take care of themselves.
            </ThemedText>
          </View>
        </>
      ) : fetchError ? (
        <ThemedText type="small" themeColor="danger">
          {fetchError}
        </ThemedText>
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.tint} />
          <ThemedText type="small" themeColor="textSecondary">
            Crunching your numbers…
          </ThemedText>
        </View>
      )}
    </OnboardingStep>
  );
}

function MacroCard({
  label,
  dot,
  value,
  onChangeText,
}: {
  label: string;
  dot: ThemeColor;
  value: string;
  onChangeText: (t: string) => void;
}) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  return (
    <Pressable
      style={[styles.macroCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
      onPress={() => inputRef.current?.focus()}>
      <View style={styles.macroHeader}>
        <View style={[styles.macroDot, { backgroundColor: theme[dot] }]} />
        <ThemedText style={[styles.macroLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
      </View>
      <View style={styles.macroValue}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          style={[styles.macroInput, { color: theme.text }]}
        />
        <ThemedText style={[styles.unit, { color: theme.textMuted }]}>g</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
  },
  hero: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
  },
  ring: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kcalInput: {
    fontFamily: Fonts.display,
    fontSize: 32,
    letterSpacing: -1,
    textAlign: 'center',
    minWidth: 100,
    padding: 0,
  },
  kcalLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.1,
    marginTop: 2,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  macroCard: {
    flex: 1,
    borderRadius: 15,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 12,
  },
  macroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  macroDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  macroLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 16,
  },
  macroValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginTop: 5,
  },
  macroInput: {
    fontFamily: Fonts.display,
    fontSize: 19,
    padding: 0,
  },
  fibreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: Spacing.three,
    marginTop: 13,
    minHeight: 52,
  },
  fibreLabel: {
    fontFamily: Fonts.bodySemibold,
  },
  fibreValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  fibreInput: {
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 15,
    marginTop: 13,
  },
  bannerIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
