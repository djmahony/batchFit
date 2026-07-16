import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { MacroLegendRow, MacroRing, macroSegments } from '@/components/macros';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type Recipe } from '@/lib/api';

const formatGrams = (grams: number) =>
  grams >= 1000 ? `${(grams / 1000).toFixed(1).replace(/\.0$/, '')} kg` : `${Math.round(grams)} g`;

// Recipe detail (mockup 1s/2s): the template's default portions, per-portion
// macros and ingredient list, with "Cook this" pre-filling the batch wizard.
export default function RecipeDetailScreen() {
  const theme = useTheme();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !params.id) return;
    setLoadError(null);
    try {
      const res = await api.recipe(token, params.id);
      setRecipe(res.recipe);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    }
  }, [token, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

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
          <ThemedText style={styles.headerTitle} numberOfLines={1}>
            {recipe?.name ?? ' '}
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
        ) : !recipe ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.tint} />
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>
              <View style={styles.chipRow}>
                <View style={[styles.recipeChip, { backgroundColor: theme.tintSoft }]}>
                  <ThemedText style={[styles.recipeChipText, { color: theme.tint }]}>RECIPE</ThemedText>
                </View>
                <ThemedText style={[styles.chipCaption, { color: theme.textMuted }]}>
                  A template — cook it into a batch
                </ThemedText>
              </View>

              <View style={[styles.infoRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                  Default portions
                </ThemedText>
                <ThemedText style={styles.infoValue}>{recipe.defaultPortions}</ThemedText>
              </View>

              <View style={[styles.macroCard, { backgroundColor: theme.heroSurface, borderColor: theme.surfaceBorder }]}>
                <MacroRing
                  size={88}
                  thickness={9}
                  segments={macroSegments(recipe.perPortionMacros, theme)}
                  trackColor={theme.barTrack}>
                  <ThemedText style={[styles.ringKcal, { color: theme.onHero }]}>
                    {Math.round(recipe.perPortionMacros.kcal)}
                  </ThemedText>
                  <ThemedText style={[styles.ringLabel, { color: theme.onHeroMuted }]}>KCAL</ThemedText>
                </MacroRing>
                <View style={styles.legend}>
                  <MacroLegendRow
                    dot="macroProtein"
                    label="Protein"
                    value={`${Math.round(recipe.perPortionMacros.protein)}g`}
                    emphasized
                    onHero
                  />
                  <MacroLegendRow
                    dot="macroCarbs"
                    label="Carbs"
                    value={`${Math.round(recipe.perPortionMacros.carbs)}g`}
                    onHero
                  />
                  <MacroLegendRow
                    dot="macroFat"
                    label="Fat"
                    value={`${Math.round(recipe.perPortionMacros.fat)}g`}
                    onHero
                  />
                </View>
              </View>

              <ThemedText style={styles.sectionHeader}>INGREDIENTS · DEFAULT</ThemedText>
              {recipe.ingredients.map((ingredient) => (
                <View
                  key={ingredient.id}
                  style={[styles.infoRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                  <ThemedText style={styles.ingredientName} numberOfLines={1}>
                    {ingredient.food.name}
                  </ThemedText>
                  <ThemedText style={[styles.ingredientGrams, { color: theme.textMuted }]}>
                    {formatGrams(ingredient.grams)}
                  </ThemedText>
                </View>
              ))}
            </ScrollView>

            <View style={styles.footer}>
              <Button
                label="Cook this"
                onPress={() =>
                  router.push({ pathname: '/new-batch', params: { recipeId: recipe.id } })
                }
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
    gap: Spacing.two,
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
    gap: 10,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  recipeChip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  recipeChipText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.7,
  },
  chipCaption: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    lineHeight: 15,
  },
  infoRow: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  infoLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 18,
  },
  infoValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 19,
  },
  macroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ringKcal: {
    fontFamily: Fonts.display,
    fontSize: 22,
    lineHeight: 25,
    letterSpacing: -0.6,
  },
  ringLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 8.5,
    letterSpacing: 0.9,
  },
  legend: {
    flex: 1,
    gap: 9,
  },
  sectionHeader: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  ingredientName: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13.5,
    lineHeight: 18,
    flexShrink: 1,
  },
  ingredientGrams: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12.5,
    lineHeight: 17,
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
