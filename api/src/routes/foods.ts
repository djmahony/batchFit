import { Router } from 'express';

import { requireAuth } from '../auth/requireAuth.js';
import { prisma } from '../prisma.js';

export const foodsRouter = Router();

foodsRouter.use(requireAuth);

// A food is visible to a user if it's a shared reference food (no owner) or their own.
const visibleTo = (userId: string) => ({ OR: [{ ownerId: null }, { ownerId: userId }] });

// GET /foods — reference foods + the caller's custom foods.
// GET /foods?query= — search the same set by name or brand (SQLite LIKE is
// case-insensitive for ASCII, which covers our food names).
foodsRouter.get('/', async (req, res) => {
  const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
  const foods = await prisma.food.findMany({
    where: {
      AND: [
        visibleTo(req.userId!),
        query === ''
          ? {}
          : { OR: [{ name: { contains: query } }, { brand: { contains: query } }] },
      ],
    },
    orderBy: { name: 'asc' },
    take: 50,
  });
  res.json({ foods });
});

// GET /foods/recent — the caller's most recently logged foods, newest first,
// one row per food (feeds the add-food "Recents" tab).
foodsRouter.get('/recent', async (req, res) => {
  const recents = await prisma.logEntry.findMany({
    where: { userId: req.userId, foodId: { not: null } },
    orderBy: { createdAt: 'desc' },
    distinct: ['foodId'],
    take: 20,
    select: { foodId: true },
  });
  const ids = recents.map((r) => r.foodId!);
  const foods = await prisma.food.findMany({
    where: { id: { in: ids }, ...visibleTo(req.userId!) },
  });
  const byId = new Map(foods.map((f) => [f.id, f]));
  res.json({ foods: ids.map((id) => byId.get(id)).filter(Boolean) });
});

// GET /foods/:id — a single visible food (reference or the caller's own).
foodsRouter.get('/:id', async (req, res) => {
  const food = await prisma.food.findFirst({
    where: { id: req.params.id, ...visibleTo(req.userId!) },
  });
  if (!food) return res.status(404).json({ error: 'food not found' });
  res.json({ food });
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
