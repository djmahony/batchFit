import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WizardStep } from '@/components/wizard-step';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useBatchDraft } from '@/context/batch-draft';
import { useTheme } from '@/hooks/use-theme';
import { api, type Recipe } from '@/lib/api';

type StartFrom = 'scratch' | 'recipe';

// New batch · step 1 (mockup 1m/2m): name it, choose scratch or a saved recipe.
// A `recipeId` param ("Cook this" from F6-4) pre-fills the draft immediately.
export default function NewBatchScreen() {
  const theme = useTheme();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ recipeId?: string }>();
  const { draft, setName, loadFromRecipe } = useBatchDraft();
  const nameInputRef = useRef<TextInput>(null);

  const [startFrom, setStartFrom] = useState<StartFrom>('scratch');
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [recipesError, setRecipesError] = useState(false);

  // "Cook this" entry point: pre-fill from the recipe and jump past the setup.
  useEffect(() => {
    if (!token || !params.recipeId) return;
    let cancelled = false;
    void api
      .recipe(token, params.recipeId)
      .then((res) => {
        if (cancelled) return;
        loadFromRecipe(res.recipe);
        router.push('/batch-ingredients');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, params.recipeId]);

  // Lazy-load the recipe list when "From a saved recipe" is opened.
  useEffect(() => {
    if (!token || startFrom !== 'recipe' || recipes !== null) return;
    void api
      .recipes(token)
      .then((res) => setRecipes(res.recipes))
      .catch(() => setRecipesError(true));
  }, [token, startFrom, recipes]);

  const pickRecipe = (recipe: Recipe) => {
    loadFromRecipe(recipe);
    router.push('/batch-ingredients');
  };

  return (
    <WizardStep
      step={1}
      title="New batch"
      leftAction="close"
      nextLabel="Next · Add ingredients"
      nextDisabled={draft.name.trim() === ''}
      onNext={() => router.push('/batch-ingredients')}>
      <View style={styles.body}>
        <Pressable
          style={[styles.nameField, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
          onPress={() => nameInputRef.current?.focus()}>
          <ThemedText style={[styles.nameLabel, { color: theme.textMuted }]}>Batch name</ThemedText>
          <TextInput
            ref={nameInputRef}
            value={draft.name}
            onChangeText={setName}
            placeholder="Chicken & Rice"
            placeholderTextColor={theme.textMuted}
            style={[styles.nameInput, { color: theme.text }]}
          />
        </Pressable>

        <ThemedText style={styles.sectionHeader}>START FROM</ThemedText>

        <StartCard
          icon="add"
          title="New from scratch"
          subtitle="Build the ingredient list yourself"
          selected={startFrom === 'scratch'}
          onPress={() => setStartFrom('scratch')}
        />
        <StartCard
          icon="list-outline"
          title="From a saved recipe"
          subtitle="Pre-fills ingredients & portions"
          selected={startFrom === 'recipe'}
          onPress={() => setStartFrom('recipe')}
        />

        {startFrom === 'recipe' &&
          (recipesError ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.recipesNote}>
              Couldn’t load your recipes just now.
            </ThemedText>
          ) : recipes && recipes.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.recipesNote}>
              No saved recipes yet — cook a batch and flip “Save as recipe” at the end.
            </ThemedText>
          ) : (
            recipes?.map((recipe) => (
              <Pressable
                key={recipe.id}
                accessibilityRole="button"
                onPress={() => pickRecipe(recipe)}
                style={({ pressed }) => [
                  styles.recipeRow,
                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={styles.recipeName} numberOfLines={1}>
                  {recipe.name}
                </ThemedText>
                <ThemedText style={[styles.recipeMeta, { color: theme.textMuted }]}>
                  makes {recipe.defaultPortions}
                </ThemedText>
              </Pressable>
            ))
          ))}
      </View>
    </WizardStep>
  );
}

function StartCard({
  icon,
  title,
  subtitle,
  selected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.startCard,
        {
          backgroundColor: theme.surface,
          borderColor: selected ? theme.tint : theme.surfaceBorder,
          borderWidth: selected ? 1.5 : 1,
        },
        pressed && styles.pressed,
      ]}>
      <View
        style={[
          styles.startIcon,
          { backgroundColor: selected ? theme.tintSoft : theme.track },
        ]}>
        <Ionicons name={icon} size={20} color={selected ? theme.tint : theme.textSecondary} />
      </View>
      <View style={styles.startText}>
        <ThemedText style={styles.startTitle}>{title}</ThemedText>
        <ThemedText style={[styles.startSubtitle, { color: theme.textMuted }]}>{subtitle}</ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={selected ? theme.tint : theme.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 12,
  },
  nameField: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  nameLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 11,
    lineHeight: 15,
  },
  nameInput: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 14.5,
    lineHeight: 19,
    marginTop: 3,
    padding: 0,
  },
  sectionHeader: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  startCard: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  startIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: { flex: 1 },
  startTitle: {
    fontFamily: Fonts.display,
    fontSize: 14.5,
    lineHeight: 19,
  },
  startSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 1,
  },
  recipesNote: {
    textAlign: 'center',
  },
  recipeRow: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  recipeName: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13.5,
    lineHeight: 18,
    flexShrink: 1,
  },
  recipeMeta: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 11.5,
    lineHeight: 15,
  },
  pressed: {
    opacity: 0.6,
  },
});
