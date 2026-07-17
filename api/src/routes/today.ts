import { Router } from 'express';

import { requireAuth } from '../auth/requireAuth.js';
import { prisma } from '../prisma.js';
import { totalMacros, perPortion } from '../macros.js';
import { progressStats, smoothTrend } from '../progress.js';

export const todayRouter = Router();

todayRouter.use(requireAuth);

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;

// GET /today?date=YYYY-MM-DD — one payload for the dashboard: the day's budget
// (consumed vs. targets), per-meal subtotals, an inventory snapshot, and the
// bodyweight mini-trend. Composes what Diary, Prep and Progress fetch alone.
todayRouter.get('/', async (req, res) => {
  const date = req.query.date;
  if (typeof date !== 'string' || !DAY_KEY.test(date)) {
    return res.status(400).json({ error: 'date must be "YYYY-MM-DD"' });
  }

  const [user, entries, activeBatches, weights] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.userId } }),
    prisma.logEntry.findMany({ where: { userId: req.userId, date }, orderBy: { createdAt: 'asc' } }),
    prisma.batch.findMany({
      where: { ownerId: req.userId, portionsRemaining: { gt: 0 } },
      include: { ingredients: { include: { food: true } } },
      orderBy: { cookedAt: 'desc' },
    }),
    prisma.weightEntry.findMany({ where: { userId: req.userId }, orderBy: { date: 'asc' } }),
  ]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Budget — same maths as /diary/summary.
  const consumed = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein,
      fat: acc.fat + e.fat,
      carbs: acc.carbs + e.carbs,
      fibre: acc.fibre + e.fibre,
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 },
  );
  const targets = {
    kcal: user.targetKcal,
    protein: user.targetProtein,
    fat: user.targetFat,
    carbs: user.targetCarbs,
    fibre: user.targetFibre,
  };
  const remaining = Object.fromEntries(
    (Object.keys(targets) as (keyof typeof targets)[]).map((key) => [
      key,
      targets[key] === null ? null : targets[key]! - consumed[key],
    ]),
  );

  // Per-meal subtotals.
  const meals = Object.fromEntries(
    MEALS.map((meal) => {
      const mealEntries = entries.filter((e) => e.meal === meal);
      return [
        meal,
        { kcal: mealEntries.reduce((sum, e) => sum + e.kcal, 0), entries: mealEntries.length },
      ];
    }),
  );

  // Inventory snapshot: total portions ready + the newest active batch for a
  // one-tap "Eat one".
  const mealsReady = activeBatches.reduce((sum, b) => sum + b.portionsRemaining, 0);
  const top = activeBatches[0] ?? null;
  const inventory = {
    mealsReady,
    activeBatches: activeBatches.length,
    topBatch: top
      ? {
          id: top.id,
          name: top.name,
          portionsRemaining: top.portionsRemaining,
          perPortionMacros: perPortion(totalMacros(top.ingredients), top.portionsTotal),
        }
      : null,
  };

  // Bodyweight mini-trend: the last 14 smoothed points.
  const trend = smoothTrend(weights.map((w) => ({ date: w.date, weightKg: w.weightKg })));
  const stats = progressStats(trend);
  const weight = {
    currentKg: stats.currentKg,
    changeKg: stats.changeKg,
    trend: trend.slice(-14),
  };

  res.json({ today: { date, budget: { consumed, targets, remaining }, meals, inventory, weight } });
});
