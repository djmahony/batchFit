import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { MacroLegendRow, MacroRing, macroSegments } from '@/components/macros';
import { ThemedText } from '@/components/themed-text';
import { WizardStep } from '@/components/wizard-step';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { draftTotals, useBatchDraft } from '@/context/batch-draft';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';

// New batch · step 4 (mockup 1p/2p): the summary, the "Save as recipe" toggle,
// and "Add to inventory".
export default function BatchReviewScreen() {
  const theme = useTheme();
  const { token } = useAuth();
  const { draft, setSaveAsRecipe, setCreatedBatch } = useBatchDraft();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = draftTotals(draft.ingredients);
  const perPortion = {
    kcal: totals.kcal / draft.portions,
    protein: totals.protein / draft.portions,
    carbs: totals.carbs / draft.portions,
    fat: totals.fat / draft.portions,
  };

  const onSave = async () => {
    if (!token || saving) return;
    setError(null);
    setSaving(true);
    const ingredients = draft.ingredients.map((i) => ({ foodId: i.food.id, grams: i.grams }));
    try {
      const res = await api.createBatch(token, {
        name: draft.name.trim(),
        portions: draft.portions,
        recipeId: draft.recipeId ?? undefined,
        ingredients,
      });
      if (draft.saveAsRecipe && !draft.recipeId) {
        // Best-effort: the batch is already saved; a recipe failure shouldn't block.
        await api
          .createRecipe(token, {
            name: draft.name.trim(),
            defaultPortions: draft.portions,
            ingredients,
          })
          .catch(() => {});
      }
      setCreatedBatch(res.batch);
      router.replace('/batch-done');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <WizardStep
      step={4}
      title="Review"
      leftAction="back"
      nextLabel="Add to inventory"
      nextLoading={saving}
      onNext={() => void onSave()}>
      <View style={styles.body}>
        <ThemedText style={styles.name}>{draft.name.trim()}</ThemedText>

        <View style={[styles.macroCard, { backgroundColor: theme.heroSurface, borderColor: theme.surfaceBorder }]}>
          <ThemedText style={[styles.macroCardHeader, { color: theme.onHeroMuted }]}>
            PER PORTION · ×{draft.portions}
          </ThemedText>
          <View style={styles.macroRow}>
            <MacroRing
              size={88}
              thickness={9}
              segments={macroSegments(perPortion, theme)}
              trackColor={theme.barTrack}>
              <ThemedText style={[styles.ringKcal, { color: theme.onHero }]}>
                {Math.round(perPortion.kcal)}
              </ThemedText>
              <ThemedText style={[styles.ringLabel, { color: theme.onHeroMuted }]}>KCAL</ThemedText>
            </MacroRing>
            <View style={styles.legend}>
              <MacroLegendRow
                dot="macroProtein"
                label="Protein"
                value={`${Math.round(perPortion.protein)}g`}
                emphasized
                onHero
              />
              <MacroLegendRow dot="macroCarbs" label="Carbs" value={`${Math.round(perPortion.carbs)}g`} onHero />
              <MacroLegendRow dot="macroFat" label="Fat" value={`${Math.round(perPortion.fat)}g`} onHero />
            </View>
          </View>
        </View>

        <View style={[styles.infoRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>Whole batch</ThemedText>
          <ThemedText style={styles.infoValue}>
            {Math.round(totals.kcal).toLocaleString('en-GB')} kcal
          </ThemedText>
        </View>
        <View style={[styles.infoRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>Ingredients</ThemedText>
          <ThemedText style={styles.infoValue}>
            {draft.ingredients.length} item{draft.ingredients.length === 1 ? '' : 's'}
          </ThemedText>
        </View>

        {!draft.recipeId && (
          <View style={[styles.recipeToggle, { backgroundColor: theme.tintSoft, borderColor: theme.surfaceBorder }]}>
            <View style={styles.recipeToggleText}>
              <ThemedText style={styles.recipeToggleTitle}>Save as recipe</ThemedText>
              <ThemedText style={[styles.recipeToggleSubtitle, { color: theme.onTintSoft }]}>
                Reuse this as a template
              </ThemedText>
            </View>
            <Switch
              value={draft.saveAsRecipe}
              onValueChange={setSaveAsRecipe}
              trackColor={{ true: theme.tint, false: theme.track }}
              thumbColor="#FFFFFF"
            />
          </View>
        )}

        {error && (
          <ThemedText type="small" themeColor="danger" style={styles.errorText}>
            {error}
          </ThemedText>
        )}
      </View>
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 11,
  },
  name: {
    fontFamily: Fonts.display,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: -0.4,
  },
  macroCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  macroCardHeader: {
    textAlign: 'center',
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.9,
    marginBottom: 13,
  },
  macroRow: {
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
  infoRow: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12.5,
    lineHeight: 17,
  },
  infoValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    lineHeight: 18,
  },
  recipeToggle: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  recipeToggleText: { flex: 1 },
  recipeToggleTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  recipeToggleSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  errorText: {
    textAlign: 'center',
  },
});
