import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WizardStep } from '@/components/wizard-step';
import { Fonts } from '@/constants/theme';
import { draftTotals, useBatchDraft } from '@/context/batch-draft';
import { useTheme } from '@/hooks/use-theme';

// New batch · step 2 (mockup 1n/2n): build the ingredient list. The prominent
// "+ Add ingredient" row pushes a dedicated search screen; picking a result
// there adds it to the draft and returns here, where it shows in the list
// with its grams editable inline. The running total tracks every change.
export default function BatchIngredientsScreen() {
  const theme = useTheme();
  const { draft, removeIngredient, setIngredientGrams } = useBatchDraft();

  // Grams fields keep local text so "12." and "" are typeable; the draft gets numbers.
  const [gramsText, setGramsText] = useState<Record<string, string>>({});

  const gramsValue = (foodId: string, grams: number) =>
    gramsText[foodId] !== undefined ? gramsText[foodId] : String(Math.round(grams));

  const onGramsChange = (foodId: string, text: string) => {
    setGramsText((t) => ({ ...t, [foodId]: text }));
    const parsed = Number(text);
    if (Number.isFinite(parsed) && parsed > 0) setIngredientGrams(foodId, parsed);
  };

  const totals = draftTotals(draft.ingredients);
  const valid =
    draft.ingredients.length > 0 &&
    draft.ingredients.every((i) => Number.isFinite(i.grams) && i.grams > 0);

  return (
    <WizardStep
      step={2}
      title="Add ingredients"
      leftAction="back"
      nextLabel="Next · Portions"
      nextDisabled={!valid}
      onNext={() => router.push('/batch-portions')}
      footerExtra={
        <View style={[styles.totalStrip, { backgroundColor: theme.heroSurface, borderColor: theme.surfaceBorder }]}>
          <ThemedText style={[styles.totalLabel, { color: theme.onHeroMuted }]}>
            Running total
          </ThemedText>
          <ThemedText style={[styles.totalValue, { color: theme.onHero }]}>
            {Math.round(totals.kcal).toLocaleString('en-GB')}{' '}
            <ThemedText style={[styles.totalUnit, { color: theme.onHeroMuted }]}>kcal</ThemedText>
          </ThemedText>
        </View>
      }>
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {draft.ingredients.map(({ food, grams }) => (
          <View
            key={food.id}
            style={[styles.ingredientRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={styles.resultText}>
              <ThemedText style={styles.rowName} numberOfLines={1}>
                {food.name}
              </ThemedText>
              <View style={styles.gramsWrap}>
                <TextInput
                  value={gramsValue(food.id, grams)}
                  onChangeText={(text) => onGramsChange(food.id, text)}
                  keyboardType="number-pad"
                  style={[styles.gramsInput, { color: theme.textSecondary }]}
                />
                <ThemedText style={[styles.rowMeta, { color: theme.textMuted }]}>g</ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.rowKcal, { color: theme.textSecondary }]}>
              {Math.round((food.kcal * grams) / 100).toLocaleString('en-GB')}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${food.name}`}
              onPress={() => removeIngredient(food.id)}
              hitSlop={8}
              style={({ pressed }) => [pressed && styles.pressed]}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </Pressable>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add ingredient"
          onPress={() => router.push('/batch-add-ingredient')}
          style={({ pressed }) => [
            styles.addIngredientRow,
            { borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <Ionicons name="add" size={15} color={theme.tint} />
          <ThemedText style={[styles.addIngredientLabel, { color: theme.textSecondary }]}>
            Add ingredient
          </ThemedText>
        </Pressable>

        {draft.ingredients.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.noMatch}>
            Add what went in the pot — amounts are the cooked weights you actually used.
          </ThemedText>
        )}
      </ScrollView>
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 9,
    paddingBottom: 12,
  },
  addIngredientRow: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 13,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  addIngredientLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 17,
  },
  ingredientRow: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultText: { flex: 1 },
  rowName: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  rowMeta: {
    fontFamily: Fonts.body,
    fontSize: 11,
    lineHeight: 15,
  },
  gramsWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginTop: 1,
  },
  gramsInput: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12.5,
    minWidth: 44,
    padding: 0,
  },
  rowKcal: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    lineHeight: 18,
  },
  noMatch: {
    textAlign: 'center',
    marginTop: 6,
  },
  totalStrip: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12.5,
    lineHeight: 17,
  },
  totalValue: {
    fontFamily: Fonts.display,
    fontSize: 16,
    lineHeight: 21,
  },
  totalUnit: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 11,
  },
  pressed: {
    opacity: 0.6,
  },
});
