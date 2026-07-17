import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { MacroLegendRow, MacroRing, macroSegments } from '@/components/macros';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type ActivityLevel, type Goal, type TdeeResult } from '@/lib/api';

const RATES: { label: string; value: number }[] = [
  { label: 'Gentle · 0.25 kg/wk', value: 0.25 },
  { label: 'Moderate · 0.5 kg/wk', value: 0.5 },
  { label: 'Aggressive · 0.75 kg/wk', value: 0.75 },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very active' },
];

// Settings → Recalculate targets (wireframe 1ab): the onboarding TDEE maths,
// re-runnable any time. Tweak goal/rate/activity, see the suggestion live,
// "Use these targets" saves and updates rings app-wide.
export default function TdeeScreen() {
  const theme = useTheme();
  const { token, user, updateUser } = useAuth();

  const [goal, setGoal] = useState<Goal>((user?.goal as Goal) ?? 'maintain');
  const [rate, setRate] = useState(user?.goalRateKgPerWk ?? 0.5);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    (user?.activityLevel as ActivityLevel) ?? 'moderate',
  );
  const [result, setResult] = useState<TdeeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canCompute =
    !!user?.sex && !!user?.birthDate && !!user?.heightCm && !!user?.currentWeightKg;

  const compute = useCallback(async () => {
    if (!token || !user || !canCompute) return;
    setError(null);
    try {
      const res = await api.tdee(token, {
        sex: user.sex as 'male' | 'female',
        birthDate: user.birthDate!,
        heightCm: user.heightCm!,
        weightKg: user.currentWeightKg!,
        activityLevel,
        goal,
        goalRateKgPerWk: goal === 'maintain' ? undefined : rate,
      });
      setResult(res);
    } catch (e) {
      setResult(null);
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id, canCompute, activityLevel, goal, rate]);

  useEffect(() => {
    void compute();
  }, [compute]);

  const onUse = async () => {
    if (!token || !result || saving) return;
    setError(null);
    setSaving(true);
    try {
      const res = await api.patchProfile(token, {
        goal,
        activityLevel,
        ...(goal !== 'maintain' ? { goalRateKgPerWk: rate } : {}),
        targetKcal: result.targets.kcal,
        targetProtein: result.targets.protein,
        targetFat: result.targets.fat,
        targetCarbs: result.targets.carbs,
        targetFibre: result.targets.fibre,
      });
      updateUser(res.user);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Calculate targets</ThemedText>
          <View style={styles.headerButton} />
        </View>

        {!canCompute ? (
          <View style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              Fill in your profile first — the maths needs your height, weight, age and sex.
            </ThemedText>
            <Button label="Open profile" onPress={() => router.push('/settings/profile')} />
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}>
              <ThemedText style={styles.sectionHeader}>GOAL</ThemedText>
              <Segmented
                options={[
                  { label: 'Lose', value: 'lose' },
                  { label: 'Maintain', value: 'maintain' },
                  { label: 'Build', value: 'build' },
                ]}
                value={goal}
                onChange={setGoal}
              />
              {goal !== 'maintain' && (
                <View style={styles.rateChips}>
                  {RATES.map((option) => {
                    const selected = rate === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setRate(option.value)}
                        style={[
                          styles.rateChip,
                          selected
                            ? { backgroundColor: theme.ink }
                            : {
                                backgroundColor: theme.surface,
                                borderColor: theme.surfaceBorder,
                                borderWidth: 1,
                              },
                        ]}>
                        <ThemedText
                          style={[
                            styles.rateChipLabel,
                            { color: selected ? theme.onInk : theme.textSecondary },
                          ]}>
                          {option.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <ThemedText style={styles.sectionHeader}>ACTIVITY</ThemedText>
              <View style={styles.rateChips}>
                {ACTIVITY_OPTIONS.map((option) => {
                  const selected = activityLevel === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setActivityLevel(option.value)}
                      style={[
                        styles.rateChip,
                        selected
                          ? { backgroundColor: theme.ink }
                          : {
                              backgroundColor: theme.surface,
                              borderColor: theme.surfaceBorder,
                              borderWidth: 1,
                            },
                      ]}>
                      <ThemedText
                        style={[
                          styles.rateChipLabel,
                          { color: selected ? theme.onInk : theme.textSecondary },
                        ]}>
                        {option.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {error ? (
                <View style={styles.centeredInline}>
                  <ThemedText type="small" themeColor="danger" style={styles.centeredText}>
                    {error}
                  </ThemedText>
                  <Button label="Try again" onPress={() => void compute()} />
                </View>
              ) : !result ? (
                <View style={styles.centeredInline}>
                  <ActivityIndicator color={theme.tint} />
                </View>
              ) : (
                <>
                  <View
                    style={[
                      styles.resultCard,
                      { backgroundColor: theme.heroSurface, borderColor: theme.surfaceBorder },
                    ]}>
                    <MacroRing
                      size={96}
                      thickness={10}
                      segments={macroSegments(
                        {
                          protein: result.targets.protein,
                          carbs: result.targets.carbs,
                          fat: result.targets.fat,
                        },
                        theme,
                      )}
                      trackColor={theme.barTrack}>
                      <ThemedText style={[styles.ringKcal, { color: theme.onHero }]}>
                        {Math.round(result.targets.kcal).toLocaleString('en-GB')}
                      </ThemedText>
                      <ThemedText style={[styles.ringLabel, { color: theme.onHeroMuted }]}>
                        KCAL / DAY
                      </ThemedText>
                    </MacroRing>
                    <View style={styles.legend}>
                      <MacroLegendRow
                        dot="macroProtein"
                        label="Protein"
                        value={`${Math.round(result.targets.protein)}g`}
                        emphasized
                        onHero
                      />
                      <MacroLegendRow
                        dot="macroCarbs"
                        label="Carbs"
                        value={`${Math.round(result.targets.carbs)}g`}
                        onHero
                      />
                      <MacroLegendRow
                        dot="macroFat"
                        label="Fat"
                        value={`${Math.round(result.targets.fat)}g`}
                        onHero
                      />
                    </View>
                  </View>
                  <ThemedText style={[styles.caption, { color: theme.textMuted }]}>
                    Recommended from your profile · maintenance ≈{' '}
                    {Math.round(result.maintenanceKcal).toLocaleString('en-GB')} kcal
                  </ThemedText>
                </>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <Button
                label="Use these targets"
                onPress={() => void onUse()}
                loading={saving}
                disabled={!result}
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.display,
    fontSize: 17,
    lineHeight: 22,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  centeredInline: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  centeredText: {
    textAlign: 'center',
    lineHeight: 20,
  },
  body: {
    paddingHorizontal: 22,
    paddingBottom: Spacing.three,
    gap: 9,
  },
  sectionHeader: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  rateChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  rateChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  rateChipLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 16,
  },
  resultCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  ringKcal: {
    fontFamily: Fonts.display,
    fontSize: 21,
    lineHeight: 25,
    letterSpacing: -0.6,
  },
  ringLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 7.5,
    letterSpacing: 0.8,
    marginTop: 1,
  },
  legend: {
    flex: 1,
    gap: 10,
  },
  caption: {
    textAlign: 'center',
    fontFamily: Fonts.body,
    fontSize: 11.5,
    lineHeight: 15,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
