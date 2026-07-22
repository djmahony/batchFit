import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { MacroLegendRow, MacroRing, macroSegments } from '@/components/macros';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, MEALS, type LogEntry, type Meal } from '@/lib/api';

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

const STEP_GRAMS = 10;

// Edit a logged entry: change the amount (macros rescale from the entry's own
// snapshot — never the live food), move it between meals, or delete it.
export default function EditEntryScreen() {
  const theme = useTheme();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();

  const [entry, setEntry] = useState<LogEntry | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [grams, setGrams] = useState('');
  const [meal, setMeal] = useState<Meal>('snacks');
  const [mealPickerOpen, setMealPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !params.id) return;
    setLoadError(null);
    try {
      const res = await api.diaryEntry(token, params.id);
      setEntry(res.entry);
      setGrams(String(Math.round(res.entry.quantity)));
      setMeal(res.entry.meal);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    }
  }, [token, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const quantity = Number(grams);
  const validQuantity = Number.isFinite(quantity) && quantity > 0;
  // Rescale the snapshot for the live preview (same maths as the API's PATCH).
  const scale = entry && validQuantity ? quantity / entry.quantity : 0;
  const scaled = entry
    ? {
        kcal: entry.kcal * scale,
        protein: entry.protein * scale,
        carbs: entry.carbs * scale,
        fat: entry.fat * scale,
      }
    : null;

  const step = (delta: number) => {
    const current = Number.isFinite(quantity) ? quantity : 0;
    setGrams(String(Math.max(STEP_GRAMS, Math.round((current + delta) / STEP_GRAMS) * STEP_GRAMS)));
  };

  const isPortion = entry?.unit === 'portion';

  const onSave = async () => {
    if (!token || !entry) return;
    if (!validQuantity) {
      setError('Amount needs to be a number above zero.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const patch: { quantity?: number; meal?: Meal } = {};
      if (quantity !== entry.quantity) patch.quantity = quantity;
      if (meal !== entry.meal) patch.meal = meal;
      if (Object.keys(patch).length > 0) {
        await api.updateDiaryEntry(token, entry.id, patch);
      }
      router.dismiss();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!token || !entry) return;
    setError(null);
    setDeleting(true);
    try {
      await api.deleteDiaryEntry(token, entry.id);
      router.dismiss();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => router.dismiss()}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="close" size={17} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle} numberOfLines={1}>
            {entry?.name ?? ' '}
          </ThemedText>
          <View style={styles.headerButton} />
        </View>

        {loadError ? (
          <View style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              {loadError}
            </ThemedText>
            <Button label="Try again" onPress={() => void load()} />
          </View>
        ) : !entry || !scaled ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.tint} />
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {/* Quantity. Batch portions are counted, not weighed (F5-4). */}
              {isPortion ? (
                <View style={[styles.stepper, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                  <ThemedText style={[styles.portionNote, { color: theme.textSecondary }]}>
                    {entry.quantity} portion{entry.quantity === 1 ? '' : 's'} from a batch
                  </ThemedText>
                </View>
              ) : (
                <View style={[styles.stepper, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${STEP_GRAMS} grams`}
                    onPress={() => step(-STEP_GRAMS)}
                    style={({ pressed }) => [
                      styles.stepButton,
                      { backgroundColor: theme.track },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText style={[styles.stepLabel, { color: theme.textSecondary }]}>–</ThemedText>
                  </Pressable>
                  <View style={styles.stepperValue}>
                    <TextInput
                      value={grams}
                      onChangeText={setGrams}
                      keyboardType="number-pad"
                      style={[styles.gramsInput, { color: theme.text }]}
                    />
                    <ThemedText style={[styles.gramsUnit, { color: theme.textMuted }]}>g</ThemedText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${STEP_GRAMS} grams`}
                    onPress={() => step(STEP_GRAMS)}
                    style={({ pressed }) => [
                      styles.stepButton,
                      { backgroundColor: theme.tint },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText style={[styles.stepLabel, { color: theme.onTint }]}>+</ThemedText>
                  </Pressable>
                </View>
              )}

              <View style={[styles.macroCard, { backgroundColor: theme.heroSurface, borderColor: theme.surfaceBorder }]}>
                <MacroRing
                  size={96}
                  thickness={10}
                  segments={macroSegments(scaled, theme)}
                  trackColor={theme.barTrack}>
                  <ThemedText style={[styles.ringKcal, { color: theme.onHero }]}>
                    {Math.round(scaled.kcal)}
                  </ThemedText>
                  <ThemedText style={[styles.ringLabel, { color: theme.onHeroMuted }]}>KCAL</ThemedText>
                </MacroRing>
                <View style={styles.legend}>
                  <MacroLegendRow
                    dot="macroProtein"
                    label="Protein"
                    value={`${Math.round(scaled.protein)}g`}
                    emphasized
                    onHero
                  />
                  <MacroLegendRow dot="macroCarbs" label="Carbs" value={`${Math.round(scaled.carbs)}g`} onHero />
                  <MacroLegendRow dot="macroFat" label="Fat" value={`${Math.round(scaled.fat)}g`} onHero />
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => setMealPickerOpen((open) => !open)}
                style={[styles.pickerRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                <ThemedText style={[styles.pickerLabel, { color: theme.textSecondary }]}>Meal</ThemedText>
                <ThemedText style={styles.pickerValue}>
                  {MEAL_LABELS[meal]} <ThemedText style={{ color: theme.textMuted }}>▾</ThemedText>
                </ThemedText>
              </Pressable>
              {mealPickerOpen && (
                <View style={styles.mealOptions}>
                  {MEALS.map((option) => {
                    const selected = option === meal;
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => {
                          setMeal(option);
                          setMealPickerOpen(false);
                        }}
                        style={[
                          styles.mealOption,
                          selected
                            ? { backgroundColor: theme.ink }
                            : { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, borderWidth: 1 },
                        ]}>
                        <ThemedText
                          style={[
                            styles.mealOptionLabel,
                            { color: selected ? theme.onInk : theme.textSecondary },
                          ]}>
                          {MEAL_LABELS[option]}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {error && (
                <ThemedText type="small" themeColor="danger" style={styles.centeredText}>
                  {error}
                </ThemedText>
              )}

              <Pressable
                accessibilityRole="button"
                onPress={() => void onDelete()}
                disabled={deleting || saving}
                style={({ pressed }) => [styles.deleteRow, (pressed || deleting) && styles.pressed]}>
                {deleting ? (
                  <ActivityIndicator color={theme.danger} size="small" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={15} color={theme.danger} />
                    <ThemedText style={[styles.deleteLabel, { color: theme.danger }]}>
                      Delete entry
                    </ThemedText>
                  </>
                )}
              </Pressable>
            </ScrollView>

            <View style={styles.footer}>
              <Button label="Save changes" onPress={() => void onSave()} loading={saving} />
            </View>
          </>
        )}
        </SafeAreaView>
      </KeyboardAvoidingView>
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
    gap: Spacing.two,
    paddingHorizontal: 22,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
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
  centeredText: {
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: Spacing.three,
    gap: 11,
  },
  stepper: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 52,
  },
  portionNote: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 16,
    lineHeight: 20,
  },
  stepperValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    minWidth: 88,
    justifyContent: 'center',
  },
  gramsInput: {
    fontFamily: Fonts.display,
    fontSize: 21,
    textAlign: 'center',
    padding: 0,
  },
  gramsUnit: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
  },
  macroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  ringKcal: {
    fontFamily: Fonts.display,
    fontSize: 25,
    lineHeight: 28,
    letterSpacing: -0.7,
  },
  ringLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 0.9,
  },
  legend: {
    flex: 1,
    gap: 10,
  },
  pickerRow: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 18,
  },
  pickerValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  mealOptions: {
    flexDirection: 'row',
    gap: 7,
  },
  mealOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  mealOptionLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 16,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  deleteLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13.5,
    lineHeight: 18,
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
