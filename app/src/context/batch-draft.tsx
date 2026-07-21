import { createContext, useContext, useMemo, useState } from 'react';

import type { Batch, Food, Recipe } from '@/lib/api';

export type DraftIngredient = { food: Food; grams: number };

/**
 * Working state for the New batch wizard (F6-3): name → ingredients → portions
 * → review. `recipeId` is set when the draft was pre-filled from a recipe
 * ("Cook this"), so the cooked batch links back to its template.
 */
type BatchDraftState = {
  name: string;
  portions: number;
  ingredients: DraftIngredient[];
  recipeId: string | null;
  saveAsRecipe: boolean;
  /** Set after a successful save so the confirmation screen can show its stats. */
  createdBatch: Batch | null;
};

type BatchDraftContextValue = {
  draft: BatchDraftState;
  setName: (name: string) => void;
  setPortions: (portions: number) => void;
  addIngredient: (food: Food) => void;
  removeIngredient: (foodId: string) => void;
  setIngredientGrams: (foodId: string, grams: number) => void;
  setSaveAsRecipe: (save: boolean) => void;
  setCreatedBatch: (batch: Batch) => void;
  loadFromRecipe: (recipe: Recipe) => void;
  reset: () => void;
};

const initialState: BatchDraftState = {
  name: '',
  portions: 4,
  ingredients: [],
  recipeId: null,
  saveAsRecipe: false,
  createdBatch: null,
};

const BatchDraftContext = createContext<BatchDraftContextValue | null>(null);

export function BatchDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<BatchDraftState>(initialState);

  const value = useMemo<BatchDraftContextValue>(
    () => ({
      draft,
      setName: (name) => setDraft((d) => ({ ...d, name })),
      setPortions: (portions) => setDraft((d) => ({ ...d, portions })),
      addIngredient: (food) =>
        setDraft((d) =>
          d.ingredients.some((i) => i.food.id === food.id)
            ? d
            : { ...d, ingredients: [...d.ingredients, { food, grams: 100 }] },
        ),
      removeIngredient: (foodId) =>
        setDraft((d) => ({ ...d, ingredients: d.ingredients.filter((i) => i.food.id !== foodId) })),
      setIngredientGrams: (foodId, grams) =>
        setDraft((d) => ({
          ...d,
          ingredients: d.ingredients.map((i) => (i.food.id === foodId ? { ...i, grams } : i)),
        })),
      setSaveAsRecipe: (saveAsRecipe) => setDraft((d) => ({ ...d, saveAsRecipe })),
      setCreatedBatch: (createdBatch) => setDraft((d) => ({ ...d, createdBatch })),
      loadFromRecipe: (recipe) =>
        setDraft({
          ...initialState,
          name: recipe.name,
          portions: recipe.defaultPortions,
          recipeId: recipe.id,
          ingredients: recipe.ingredients.map((i) => ({ food: i.food, grams: i.grams })),
        }),
      reset: () => setDraft(initialState),
    }),
    [draft],
  );

  return <BatchDraftContext.Provider value={value}>{children}</BatchDraftContext.Provider>;
}

export function useBatchDraft() {
  const context = useContext(BatchDraftContext);
  if (!context) throw new Error('useBatchDraft must be used inside BatchDraftProvider');
  return context;
}

/** Whole-draft macro totals (foods are per 100g). */
export function draftTotals(ingredients: DraftIngredient[]) {
  return ingredients.reduce(
    (acc, { food, grams }) => {
      const factor = grams / 100;
      acc.kcal += food.kcal * factor;
      acc.protein += food.protein * factor;
      acc.fat += food.fat * factor;
      acc.carbs += food.carbs * factor;
      acc.fibre += food.fibre * factor;
      return acc;
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 },
  );
}
