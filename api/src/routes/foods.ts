import { Router } from 'express';

import { requireAuth } from '../auth/requireAuth.js';
import { prisma } from '../prisma.js';

export const foodsRouter = Router();

foodsRouter.use(requireAuth);

// A food is visible to a user if it's a shared reference food (no owner) or their own.
const visibleTo = (userId: string) => ({ OR: [{ ownerId: null }, { ownerId: userId }] });

// GET /foods — reference foods + the caller's custom foods.
foodsRouter.get('/', async (req, res) => {
  const foods = await prisma.food.findMany({
    where: visibleTo(req.userId!),
    orderBy: { name: 'asc' },
  });
  res.json({ foods });
});

const MACROS = ['kcal', 'protein', 'fat', 'carbs', 'fibre'] as const;

// POST /foods — create a custom food owned by the caller (macros are per 100g).
foodsRouter.post('/', async (req, res) => {
  const { name, brand } = req.body ?? {};
  if (typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }

  const macros: Record<string, number> = {};
  for (const key of MACROS) {
    const value = req.body?.[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return res.status(400).json({ error: `${key} must be a non-negative number` });
    }
    macros[key] = value;
  }

  const food = await prisma.food.create({
    data: {
      name: name.trim(),
      brand: typeof brand === 'string' && brand.trim() !== '' ? brand.trim() : null,
      ownerId: req.userId!,
      kcal: macros.kcal,
      protein: macros.protein,
      fat: macros.fat,
      carbs: macros.carbs,
      fibre: macros.fibre,
    },
  });
  res.status(201).json({ food });
});
