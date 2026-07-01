import { Router } from 'express';

import { prisma } from '../prisma.js';
import { totalMacros, perPortion } from '../macros.js';

export const batchesRouter = Router();

// Shape a batch for the client: attach whole-batch totals and per-portion macros.
function withMacros(batch: {
  portionsTotal: number;
  ingredients: { grams: number; food: { kcal: number; protein: number; fat: number; carbs: number; fibre: number } }[];
}) {
  const total = totalMacros(batch.ingredients);
  return {
    ...batch,
    totalMacros: total,
    perPortionMacros: perPortion(total, batch.portionsTotal),
  };
}

const batchInclude = { ingredients: { include: { food: true } }, recipe: true } as const;

// GET /batches — the inventory: active batches (portions remaining > 0) first.
batchesRouter.get('/', async (_req, res) => {
  const batches = await prisma.batch.findMany({
    include: batchInclude,
    orderBy: { cookedAt: 'desc' },
  });
  res.json(batches.map(withMacros));
});

// GET /batches/:id
batchesRouter.get('/:id', async (req, res) => {
  const batch = await prisma.batch.findUnique({
    where: { id: req.params.id },
    include: batchInclude,
  });
  if (!batch) return res.status(404).json({ error: 'batch not found' });
  res.json(withMacros(batch));
});

// POST /batches — record a cook. Snapshots the ingredient amounts used.
// Body: { name, portions, recipeId?, ingredients: [{ foodId, grams }] }
batchesRouter.post('/', async (req, res) => {
  const { name, portions, recipeId, ingredients } = req.body ?? {};
  if (typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!Number.isInteger(portions) || portions < 1) {
    return res.status(400).json({ error: 'portions must be a positive integer' });
  }
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ error: 'at least one ingredient is required' });
  }

  const batch = await prisma.batch.create({
    data: {
      name,
      recipeId: recipeId ?? null,
      portionsTotal: portions,
      portionsRemaining: portions,
      ingredients: {
        create: ingredients.map((i: { foodId: string; grams: number }) => ({
          foodId: i.foodId,
          grams: Number(i.grams) || 0,
        })),
      },
    },
    include: batchInclude,
  });
  res.status(201).json(withMacros(batch));
});

// POST /batches/:id/eat — eat one portion: decrement the inventory count.
// (Logging the portion to a food diary is Phase-3 work; this just adjusts stock.)
batchesRouter.post('/:id/eat', async (req, res) => {
  const batch = await prisma.batch.findUnique({ where: { id: req.params.id } });
  if (!batch) return res.status(404).json({ error: 'batch not found' });
  if (batch.portionsRemaining <= 0) {
    return res.status(409).json({ error: 'no portions remaining' });
  }
  const updated = await prisma.batch.update({
    where: { id: batch.id },
    data: { portionsRemaining: batch.portionsRemaining - 1 },
    include: batchInclude,
  });
  res.json(withMacros(updated));
});
