import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type ActivityLevel, type Sex } from '@/lib/api';
import { FieldRow } from '@/app/settings/targets';

const KG_PER_LB = 0.45359237;

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Lightly active' },
  { value: 'moderate', label: 'Moderately active' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very active' },
];

const num = (s: string) => Number(s.replace(',', '.'));

// Settings → Profile: the body stats behind the TDEE maths. Weight fields show
// the user's unit (converted to kg for the API); height stays in cm for MVP.
export default function ProfileSettingsScreen() {
  const theme = useTheme();
  const { token, user, updateUser } = useAuth();

  const imperial = user?.units === 'imperial';
  const toDisplay = (kg: number | null) =>
    kg === null ? '' : (imperial ? kg / KG_PER_LB : kg).toFixed(1);

  const [sex, setSex] = useState<Sex>((user?.sex as Sex) ?? 'male');
  const [heightCm, setHeightCm] = useState(user?.heightCm ? String(Math.round(user.heightCm)) : '');
  const [weight, setWeight] = useState(toDisplay(user?.currentWeightKg ?? null));
  const [goalWeight, setGoalWeight] = useState(toDisplay(user?.goalWeightKg ?? null));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    (user?.activityLevel as ActivityLevel) ?? 'moderate',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weightUnit = imperial ? 'lb' : 'kg';
  const toKg = (value: number) => (imperial ? value * KG_PER_LB : value);

  const onSave = async () => {
    if (!token || saving) return;
    const height = num(heightCm);
    const weightValue = num(weight);
    if (!(height > 0) || !(weightValue > 0)) {
      setError('Height and weight need to be numbers above zero.');
      return;
    }
    const goalValue = goalWeight.trim() === '' ? null : num(goalWeight);
    if (goalValue !== null && !(goalValue > 0)) {
      setError('Goal weight needs to be a number above zero (or blank).');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await api.patchProfile(token, {
        sex,
        heightCm: height,
        currentWeightKg: toKg(weightValue),
        goalWeightKg: goalValue === null ? null : toKg(goalValue),
        activityLevel,
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
          <ThemedText style={styles.headerTitle}>Profile</ThemedText>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.sectionHeader}>SEX</ThemedText>
          <Segmented
            options={[
              { label: 'Male', value: 'male' },
              { label: 'Female', value: 'female' },
            ]}
            value={sex}
            onChange={setSex}
          />

          <ThemedText style={styles.sectionHeader}>BODY</ThemedText>
          <FieldRow label="Height" value={heightCm} onChangeText={setHeightCm} unit="cm" />
          <FieldRow label="Current weight" value={weight} onChangeText={setWeight} unit={weightUnit} />
          <FieldRow label="Goal weight" value={goalWeight} onChangeText={setGoalWeight} unit={weightUnit} />

          <ThemedText style={styles.sectionHeader}>ACTIVITY</ThemedText>
          {ACTIVITY_OPTIONS.map((option) => {
            const selected = activityLevel === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setActivityLevel(option.value)}
                style={[
                  styles.activityRow,
                  {
                    backgroundColor: theme.surface,
                    borderColor: selected ? theme.tint : theme.surfaceBorder,
                    borderWidth: selected ? 1.5 : 1,
                  },
                ]}>
                <ThemedText
                  style={[styles.activityLabel, selected && styles.activityLabelSelected]}>
                  {option.label}
                </ThemedText>
                {selected && <Ionicons name="checkmark" size={16} color={theme.tint} />}
              </Pressable>
            );
          })}

          {error && (
            <ThemedText type="small" themeColor="danger" style={styles.errorText}>
              {error}
            </ThemedText>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Save changes" onPress={() => void onSave()} loading={saving} />
        </View>
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
  activityRow: {
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  activityLabelSelected: {
    fontFamily: Fonts.bodyBold,
  },
  errorText: {
    textAlign: 'center',
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
