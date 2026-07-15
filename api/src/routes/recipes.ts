import { Router } from 'express';

import { requireAuth } from '../auth/requireAuth.js';
import { prisma } from '../prisma.js';
import { totalMacros, perPortion } from '../macros.js';

export const recipesRouter = Router();

recipesRouter.use(requireAuth);

// Per-portion macros for a recipe come from its default amounts + portion count.
function withMacros(recipe: {
  defaultPortions: number;
  ingredients: { grams: number; food: { kcal: number; protein: number; fat: number; carbs: number; fibre: number } }[];
}) {
  const total = totalMacros(recipe.ingredients);
  return {
    ...recipe,
    totalMacros: total,
    perPortionMacros: perPortion(total, recipe.defaultPortions),
  };
}

const recipeInclude = { ingredients: { include: { food: true } } } as const;

type IngredientInput = { foodId: string; grams: number };

// Shared validation for create/update. Returns an error message or null.
async function validateBody(
  userId: string,
  body: { name?: unknown; defaultPortions?: unknown; ingredients?: unknown },
): Promise<string | null> {
  const { name, defaultPortions, ingredients } = body;
  if (typeof name !== 'string' || name.trim() === '') return 'name is required';
  if (!Number.isInteger(defaultPortions) || (defaultPortions as number) < 1) {
    return 'defaultPortions must be a positive integer';
  }
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return 'at least one ingredient is required';
  }
  for (const ingredient of ingredients) {
    if (typeof ingredient?.foodId !== 'string' || ingredient.foodId === '') {
      return 'every ingredient needs a foodId';
    }
    const grams = ingredient?.grams;
    if (typeof grams !== 'number' || !Number.isFinite(grams) || grams <= 0) {
      return 'every ingredient needs positive grams';
    }
  }
  const foodIds = [...new Set((ingredients as IngredientInput[]).map((i) => i.foodId))];
  const visible = await prisma.food.count({
    where: { id: { in: foodIds }, OR: [{ ownerId: null }, { ownerId: userId }] },
  });
  if (visible !== foodIds.length) return 'food not found';
  return null;
}

// GET /recipes — the caller's recipe book, A→Z.
recipesRouter.get('/', async (req, res) => {
  const recipes = await prisma.recipe.findMany({
    where: { ownerId: req.userId },
    include: recipeInclude,
    orderBy: { name: 'asc' },
  });
  res.json({ recipes: recipes.map(withMacros) });
});

// GET /recipes/:id
recipesRouter.get('/:id', async (req, res) => {
  const recipe = await prisma.recipe.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
    include: recipeInclude,
  });
  if (!recipe) return res.status(404).json({ error: 'recipe not found' });
  res.json({ recipe: withMacros(recipe) });
});

// POST /recipes — create a template.
// Body: { name, defaultPortions, ingredients: [{ foodId, grams }] }
recipesRouter.post('/', async (req, res) => {
  const error = await validateBody(req.userId!, req.body ?? {});
  if (error) return res.status(error === 'food not found' ? 404 : 400).json({ error });
  const { name, defaultPortions, ingredients } = req.body as {
    name: string;
    defaultPortions: number;
    ingredients: IngredientInput[];
  };

  const recipe = await prisma.recipe.create({
    data: {
      name: name.trim(),
      ownerId: req.userId!,
      defaultPortions,
      ingredients: { create: ingredients.map((i) => ({ foodId: i.foodId, grams: i.grams })) },
    },
    include: recipeInclude,
  });
  res.status(201).json({ recipe: withMacros(recipe) });
});

// PUT /recipes/:id — update the template (name, portions, full ingredient list).
// Editing a recipe never touches batches already cooked from it — they snapshot.
recipesRouter.put('/:id', async (req, res) => {
  const existing = await prisma.recipe.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
  });
  if (!existing) return res.status(404).json({ error: 'recipe not found' });

  const error = await validateBody(req.userId!, req.body ?? {});
  if (error) return res.status(error === 'food not found' ? 404 : 400).json({ error });
  const { name, defaultPortions, ingredients } = req.body as {
    name: string;
    defaultPortions: number;
    ingredients: IngredientInput[];
  };

  const [, recipe] = await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { recipeId: existing.id } }),
    prisma.recipe.update({
      where: { id: existing.id },
      data: {
        name: name.trim(),
        defaultPortions,
        ingredients: { create: ingredients.map((i) => ({ foodId: i.foodId, grams: i.grams })) },
      },
      include: recipeInclude,
    }),
  ]);
  res.json({ recipe: withMacros(recipe) });
});
