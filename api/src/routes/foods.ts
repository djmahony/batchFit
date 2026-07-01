import { Router } from 'express';

import { prisma } from '../prisma.js';

export const foodsRouter = Router();

// GET /foods — list reference foods.
foodsRouter.get('/', async (_req, res) => {
  const foods = await prisma.food.findMany({ orderBy: { name: 'asc' } });
  res.json(foods);
});

// POST /foods — create a food (macros are per 100g).
foodsRouter.post('/', async (req, res) => {
  const { name, brand, kcal, protein, fat, carbs, fibre } = req.body ?? {};
  if (typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }
  const food = await prisma.food.create({
    data: {
      name,
      brand: brand ?? null,
      kcal: Number(kcal) || 0,
      protein: Number(protein) || 0,
      fat: Number(fat) || 0,
      carbs: Number(carbs) || 0,
      fibre: Number(fibre) || 0,
    },
  });
  res.status(201).json(food);
});
