import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing, type ThemeColor } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type Goal } from '@/lib/api';

const num = (s: string) => Number(s.replace(',', '.'));

// Settings → Goals & targets: edit the goal (+ weekly rate) and the five daily
// targets directly. "Recalculate targets" (TDEE) lives on its own screen.
export default function TargetsSettingsScreen() {
  const theme = useTheme();
  const { token, user, updateUser } = useAuth();

  const [goal, setGoal] = useState<Goal>((user?.goal as Goal) ?? 'maintain');
  const [rate, setRate] = useState(user?.goalRateKgPerWk ? String(user.goalRateKgPerWk) : '0.5');
  const [kcal, setKcal] = useState(user?.targetKcal ? String(Math.round(user.targetKcal)) : '');
  const [protein, setProtein] = useState(user?.targetProtein ? String(Math.round(user.targetProtein)) : '');
  const [carbs, setCarbs] = useState(user?.targetCarbs ? String(Math.round(user.targetCarbs)) : '');
  const [fat, setFat] = useState(user?.targetFat ? String(Math.round(user.targetFat)) : '');
  const [fibre, setFibre] = useState(user?.targetFibre ? String(Math.round(user.targetFibre)) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    if (!token || saving) return;
    const targets = {
      targetKcal: num(kcal),
      targetProtein: num(protein),
      targetCarbs: num(carbs),
      targetFat: num(fat),
      targetFibre: num(fibre),
    };
    if (Object.values(targets).some((v) => !(v > 0))) {
      setError('Targets need to be numbers above zero.');
      return;
    }
    const rateValue = num(rate);
    if (goal !== 'maintain' && !(rateValue > 0)) {
      setError('Weekly rate needs to be above zero.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await api.patchProfile(token, {
        goal,
        ...(goal !== 'maintain' ? { goalRateKgPerWk: rateValue } : {}),
        ...targets,
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
          <ThemedText style={styles.headerTitle}>Goals & targets</ThemedText>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
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
            <FieldRow
              label={goal === 'lose' ? 'Lose per week' : 'Gain per week'}
              value={rate}
              onChangeText={setRate}
              unit="kg"
            />
          )}

          <ThemedText style={styles.sectionHeader}>DAILY TARGETS</ThemedText>
          <FieldRow label="Calories" value={kcal} onChangeText={setKcal} unit="kcal" bold />
          <FieldRow label="Protein" dot="tint" value={protein} onChangeText={setProtein} unit="g" bold />
          <FieldRow label="Carbs" dot="macroCarbs" value={carbs} onChangeText={setCarbs} unit="g" />
          <FieldRow label="Fat" dot="macroFat" value={fat} onChangeText={setFat} unit="g" />
          <FieldRow label="Fibre" value={fibre} onChangeText={setFibre} unit="g" />

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

export function FieldRow({
  label,
  dot,
  value,
  onChangeText,
  unit,
  bold,
}: {
  label: string;
  dot?: ThemeColor;
  value: string;
  onChangeText: (v: string) => void;
  unit?: string;
  bold?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.fieldRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
      <View style={styles.fieldLabelWrap}>
        {dot && <View style={[styles.fieldDot, { backgroundColor: theme[dot] }]} />}
        <ThemedText style={[styles.fieldLabel, bold && styles.fieldLabelBold]}>{label}</ThemedText>
      </View>
      <View style={styles.fieldValueWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={theme.textMuted}
          style={[styles.fieldInput, { color: theme.text }]}
        />
        {unit && <ThemedText style={[styles.fieldUnit, { color: theme.textMuted }]}>{unit}</ThemedText>}
      </View>
    </View>
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
  fieldRow: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  fieldDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  fieldLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  fieldLabelBold: {
    fontFamily: Fonts.bodyBold,
  },
  fieldValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  fieldInput: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    textAlign: 'right',
    minWidth: 56,
    padding: 0,
  },
  fieldUnit: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12,
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
