// The heart of BatchFit: total a cook's macros across its ingredients, then
// divide by portions to get per-portion macros. The five tracked nutrients are
// calories, protein, fat, carbs, fibre.

export type Macros = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fibre: number;
};

/** A food's macros (stored per 100g) plus the grams used in this cook. */
type IngredientForMacros = {
  grams: number;
  food: Macros;
};

const empty = (): Macros => ({ kcal: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 });

/** Sum macros across all ingredients (each food's values are per 100g). */
export function totalMacros(ingredients: IngredientForMacros[]): Macros {
  return ingredients.reduce<Macros>((acc, { grams, food }) => {
    const factor = grams / 100;
    acc.kcal += food.kcal * factor;
    acc.protein += food.protein * factor;
    acc.fat += food.fat * factor;
    acc.carbs += food.carbs * factor;
    acc.fibre += food.fibre * factor;
    return acc;
  }, empty());
}

/** Divide whole-batch totals by the number of portions. */
export function perPortion(total: Macros, portions: number): Macros {
  if (portions <= 0) return empty();
  return {
    kcal: total.kcal / portions,
    protein: total.protein / portions,
    fat: total.fat / portions,
    carbs: total.carbs / portions,
    fibre: total.fibre / portions,
  };
}
