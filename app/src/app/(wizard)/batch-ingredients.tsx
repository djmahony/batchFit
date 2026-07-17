import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WizardStep } from '@/components/wizard-step';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { draftTotals, useBatchDraft } from '@/context/batch-draft';
import { useTheme } from '@/hooks/use-theme';
import { api, type Food } from '@/lib/api';

// New batch · step 2 (mockup 1n/2n): build the ingredient list. Search adds a
// food at 100g; grams are edited inline; the running total tracks every change.
export default function BatchIngredientsScreen() {
  const theme = useTheme();
  const { token } = useAuth();
  const { draft, addIngredient, removeIngredient, setIngredientGrams } = useBatchDraft();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  // Grams fields keep local text so "12." and "" are typeable; the draft gets numbers.
  const [gramsText, setGramsText] = useState<Record<string, string>>({});

  const trimmed = query.trim();

  useEffect(() => {
    if (!token || trimmed === '') {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void api
        .searchFoods(token, trimmed)
        .then((res) => setResults(res.foods.slice(0, 6)))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [token, trimmed]);

  const add = (food: Food) => {
    addIngredient(food);
    setQuery('');
    setResults([]);
  };

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
        <View style={[styles.searchField, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <Ionicons name="search" size={16} color={theme.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search ingredient…"
            placeholderTextColor={theme.textMuted}
            autoCorrect={false}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        {results.map((food) => (
          <Pressable
            key={food.id}
            accessibilityRole="button"
            onPress={() => add(food)}
            style={({ pressed }) => [
              styles.resultRow,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              pressed && styles.pressed,
            ]}>
            <View style={styles.resultText}>
              <ThemedText style={styles.rowName} numberOfLines={1}>
                {food.name}
              </ThemedText>
              <ThemedText style={[styles.rowMeta, { color: theme.textMuted }]}>
                {Math.round(food.kcal)} kcal / 100g
              </ThemedText>
            </View>
            <View style={[styles.addBubble, { backgroundColor: theme.tintSoft }]}>
              <Ionicons name="add" size={14} color={theme.tint} />
            </View>
          </Pressable>
        ))}
        {trimmed !== '' && results.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.noMatch}>
            Nothing matched that.
          </ThemedText>
        )}

        {trimmed === '' &&
          draft.ingredients.map(({ food, grams }) => (
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

        {trimmed === '' && draft.ingredients.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.noMatch}>
            Search for what went in the pot — amounts are the cooked weights you actually used.
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
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 13.5,
    paddingVertical: 0,
  },
  resultRow: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
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
  addBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
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
