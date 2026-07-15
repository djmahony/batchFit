import { Router } from 'express';

import { requireAuth } from '../auth/requireAuth.js';
import { prisma } from '../prisma.js';

export const diaryRouter = Router();

diaryRouter.use(requireAuth);

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const isPositive = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

// POST /diary — log a food to a meal. Body: { date, meal, foodId, quantity } —
// quantity is grams. Macros are scaled from the food's per-100g values and
// snapshotted onto the entry, so later food edits never rewrite the diary.
diaryRouter.post('/', async (req, res) => {
  const { date, meal, foodId, quantity } = req.body ?? {};

  if (typeof date !== 'string' || !DAY_KEY.test(date)) {
    return res.status(400).json({ error: 'date must be "YYYY-MM-DD"' });
  }
  if (!MEALS.includes(meal)) {
    return res.status(400).json({ error: 'meal must be breakfast, lunch, dinner or snacks' });
  }
  if (!isPositive(quantity)) {
    return res.status(400).json({ error: 'quantity must be a positive number (grams)' });
  }
  if (typeof foodId !== 'string' || foodId === '') {
    return res.status(400).json({ error: 'foodId is required' });
  }

  const food = await prisma.food.findFirst({
    where: { id: foodId, OR: [{ ownerId: null }, { ownerId: req.userId }] },
  });
  if (!food) return res.status(404).json({ error: 'food not found' });

  const factor = quantity / 100;
  const entry = await prisma.logEntry.create({
    data: {
      userId: req.userId!,
      date,
      meal,
      name: food.name,
      foodId: food.id,
      quantity,
      unit: 'g',
      kcal: food.kcal * factor,
      protein: food.protein * factor,
      fat: food.fat * factor,
      carbs: food.carbs * factor,
      fibre: food.fibre * factor,
    },
  });
  res.status(201).json({ entry });
});

// GET /diary?date=YYYY-MM-DD — the day's entries, oldest first.
diaryRouter.get('/', async (req, res) => {
  const date = req.query.date;
  if (typeof date !== 'string' || !DAY_KEY.test(date)) {
    return res.status(400).json({ error: 'date must be "YYYY-MM-DD"' });
  }

  const entries = await prisma.logEntry.findMany({
    where: { userId: req.userId, date },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ entries });
});

// PATCH /diary/:id — edit an entry. Changing quantity rescales the snapshotted
// macros proportionally (from the snapshot, not the live food — no rewrites).
// meal and date can also move.
diaryRouter.patch('/:id', async (req, res) => {
  const existing = await prisma.logEntry.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!existing) return res.status(404).json({ error: 'entry not found' });

  const { quantity, meal, date } = req.body ?? {};
  const data: Record<string, unknown> = {};

  if (quantity !== undefined) {
    if (!isPositive(quantity)) {
      return res.status(400).json({ error: 'quantity must be a positive number (grams)' });
    }
    const scale = quantity / existing.quantity;
    data.quantity = quantity;
    data.kcal = existing.kcal * scale;
    data.protein = existing.protein * scale;
    data.fat = existing.fat * scale;
    data.carbs = existing.carbs * scale;
    data.fibre = existing.fibre * scale;
  }
  if (meal !== undefined) {
    if (!MEALS.includes(meal)) {
      return res.status(400).json({ error: 'meal must be breakfast, lunch, dinner or snacks' });
    }
    data.meal = meal;
  }
  if (date !== undefined) {
    if (typeof date !== 'string' || !DAY_KEY.test(date)) {
      return res.status(400).json({ error: 'date must be "YYYY-MM-DD"' });
    }
    data.date = date;
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'nothing to update' });
  }

  const entry = await prisma.logEntry.update({ where: { id: existing.id }, data });
  res.json({ entry });
});

// DELETE /diary/:id
diaryRouter.delete('/:id', async (req, res) => {
  const existing = await prisma.logEntry.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!existing) return res.status(404).json({ error: 'entry not found' });

  await prisma.logEntry.delete({ where: { id: existing.id } });
  res.status(204).end();
});
