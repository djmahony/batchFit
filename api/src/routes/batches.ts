import { Router } from 'express';

import { requireAuth } from '../auth/requireAuth.js';
import { prisma } from '../prisma.js';
import { totalMacros, perPortion } from '../macros.js';

export const batchesRouter = Router();

batchesRouter.use(requireAuth);

const ADJUSTMENT_REASONS = ['given_away', 'spoiled', 'damaged', 'other'] as const;

// Shape a batch for the client: attach whole-batch totals, per-portion macros,
// and the consumption breakdown. "Eaten" is derived, not stored — it's
// whatever isn't accounted for by portionsRemaining or a reasoned adjustment.
function withMacros(batch: {
  portionsTotal: number;
  portionsRemaining: number;
  ingredients: { grams: number; food: { kcal: number; protein: number; fat: number; carbs: number; fibre: number } }[];
  adjustments: { portions: number; reason: string }[];
}) {
  const total = totalMacros(batch.ingredients);
  const removed = batch.adjustments.reduce((sum, a) => sum + a.portions, 0);
  const consumption = {
    eaten: batch.portionsTotal - batch.portionsRemaining - removed,
    given_away: 0,
    spoiled: 0,
    damaged: 0,
    other: 0,
  };
  for (const a of batch.adjustments) {
    if (a.reason === 'given_away' || a.reason === 'spoiled' || a.reason === 'damaged' || a.reason === 'other') {
      consumption[a.reason] += a.portions;
    }
  }
  return {
    ...batch,
    totalMacros: total,
    perPortionMacros: perPortion(total, batch.portionsTotal),
    consumption,
  };
}

const batchInclude = {
  ingredients: { include: { food: true } },
  recipe: true,
  adjustments: { orderBy: { createdAt: 'desc' } },
} as const;

// GET /batches — the caller's cooks, newest first. `?status=active` keeps only
// batches with portions remaining (the live inventory); `?status=depleted` is
// the history of finished batches.
batchesRouter.get('/', async (req, res) => {
  const status = req.query.status;
  if (status !== undefined && status !== 'active' && status !== 'depleted') {
    return res.status(400).json({ error: 'status must be "active" or "depleted"' });
  }

  const batches = await prisma.batch.findMany({
    where: {
      ownerId: req.userId,
      ...(status === 'active' ? { portionsRemaining: { gt: 0 } } : {}),
      ...(status === 'depleted' ? { portionsRemaining: 0 } : {}),
    },
    include: batchInclude,
    orderBy: { cookedAt: 'desc' },
  });
  res.json({ batches: batches.map(withMacros) });
});

// GET /batches/:id
batchesRouter.get('/:id', async (req, res) => {
  const batch = await prisma.batch.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
    include: batchInclude,
  });
  if (!batch) return res.status(404).json({ error: 'batch not found' });
  res.json({ batch: withMacros(batch) });
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
  for (const ingredient of ingredients) {
    const grams = ingredient?.grams;
    if (typeof ingredient?.foodId !== 'string' || ingredient.foodId === '') {
      return res.status(400).json({ error: 'every ingredient needs a foodId' });
    }
    if (typeof grams !== 'number' || !Number.isFinite(grams) || grams <= 0) {
      return res.status(400).json({ error: 'every ingredient needs positive grams' });
    }
  }

  // Every ingredient food must be visible to the caller (reference or own).
  const foodIds = [...new Set((ingredients as { foodId: string }[]).map((i) => i.foodId))];
  const visible = await prisma.food.count({
    where: { id: { in: foodIds }, OR: [{ ownerId: null }, { ownerId: req.userId }] },
  });
  if (visible !== foodIds.length) {
    return res.status(404).json({ error: 'food not found' });
  }

  const batch = await prisma.batch.create({
    data: {
      name: name.trim(),
      ownerId: req.userId!,
      recipeId: recipeId ?? null,
      portionsTotal: portions,
      portionsRemaining: portions,
      ingredients: {
        create: (ingredients as { foodId: string; grams: number }[]).map((i) => ({
          foodId: i.foodId,
          grams: i.grams,
        })),
      },
    },
    include: batchInclude,
  });
  res.status(201).json({ batch: withMacros(batch) });
});

// PATCH /batches/:id — adjust the remaining count (gave one away, dropped one…).
// Only stock changes; logged diary history is untouched (entries snapshot).
batchesRouter.patch('/:id', async (req, res) => {
  const batch = await prisma.batch.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
  });
  if (!batch) return res.status(404).json({ error: 'batch not found' });

  const { portionsRemaining } = req.body ?? {};
  if (
    !Number.isInteger(portionsRemaining) ||
    portionsRemaining < 0 ||
    portionsRemaining > batch.portionsTotal
  ) {
    return res
      .status(400)
      .json({ error: `portionsRemaining must be an integer from 0 to ${batch.portionsTotal}` });
  }

  const updated = await prisma.batch.update({
    where: { id: batch.id },
    data: { portionsRemaining },
    include: batchInclude,
  });
  res.json({ batch: withMacros(updated) });
});

// DELETE /batches/:id — remove a cook from the inventory. Diary entries eaten
// from it stay exactly as logged.
batchesRouter.delete('/:id', async (req, res) => {
  const batch = await prisma.batch.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
  });
  if (!batch) return res.status(404).json({ error: 'batch not found' });

  await prisma.batch.delete({ where: { id: batch.id } });
  res.status(204).end();
});

const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'];
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const localToday = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

// POST /batches/:id/eat — the core mechanic: eat one or more portions. Logs the
// portions to the diary (macros snapshotted per-portion, unit "portion") **and**
// decrements the inventory count, atomically. Body: { date?, meal?, portions? }
// — date defaults to today (server-local), meal to snacks, portions to 1.
batchesRouter.post('/:id/eat', async (req, res) => {
  const { date = localToday(), meal = 'snacks', portions = 1 } = req.body ?? {};
  if (typeof date !== 'string' || !DAY_KEY.test(date)) {
    return res.status(400).json({ error: 'date must be "YYYY-MM-DD"' });
  }
  if (!MEALS.includes(meal)) {
    return res.status(400).json({ error: 'meal must be breakfast, lunch, dinner or snacks' });
  }
  if (!Number.isInteger(portions) || portions < 1) {
    return res.status(400).json({ error: 'portions must be a positive integer' });
  }

  const batch = await prisma.batch.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
    include: batchInclude,
  });
  if (!batch) return res.status(404).json({ error: 'batch not found' });
  if (batch.portionsRemaining < portions) {
    return res.status(409).json({ error: 'not enough portions remaining' });
  }

  const portion = perPortion(totalMacros(batch.ingredients), batch.portionsTotal);
  const [updated, entry] = await prisma.$transaction([
    prisma.batch.update({
      where: { id: batch.id },
      data: { portionsRemaining: batch.portionsRemaining - portions },
      include: batchInclude,
    }),
    prisma.logEntry.create({
      data: {
        userId: req.userId!,
        date,
        meal,
        name: batch.name,
        quantity: portions,
        unit: 'portion',
        kcal: portion.kcal * portions,
        protein: portion.protein * portions,
        fat: portion.fat * portions,
        carbs: portion.carbs * portions,
        fibre: portion.fibre * portions,
      },
    }),
  ]);
  res.json({ batch: withMacros(updated), entry });
});

// POST /batches/:id/adjustments — reduce stock for a reason other than eating
// (given away, spoiled, damaged, other). Covers the whole reduction in one
// record, decrementing portionsRemaining atomically. Never touches the diary.
// Body: { portions, reason, note? } — note is only meaningful for "other" but
// isn't enforced either way.
batchesRouter.post('/:id/adjustments', async (req, res) => {
  const { portions, reason, note } = req.body ?? {};
  if (!Number.isInteger(portions) || portions < 1) {
    return res.status(400).json({ error: 'portions must be a positive integer' });
  }
  if (!ADJUSTMENT_REASONS.includes(reason)) {
    return res.status(400).json({ error: `reason must be one of ${ADJUSTMENT_REASONS.join(', ')}` });
  }
  if (note !== undefined && typeof note !== 'string') {
    return res.status(400).json({ error: 'note must be a string' });
  }

  const batch = await prisma.batch.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
    include: batchInclude,
  });
  if (!batch) return res.status(404).json({ error: 'batch not found' });
  if (batch.portionsRemaining < portions) {
    return res.status(409).json({ error: 'not enough portions remaining' });
  }

  // Create the adjustment first — the update's `include: batchInclude` reads
  // adjustments back, and it must see this one to derive "eaten" correctly.
  const [adjustment, updated] = await prisma.$transaction([
    prisma.batchAdjustment.create({
      data: {
        batchId: batch.id,
        portions,
        reason,
        note: note?.trim() || null,
      },
    }),
    prisma.batch.update({
      where: { id: batch.id },
      data: { portionsRemaining: batch.portionsRemaining - portions },
      include: batchInclude,
    }),
  ]);
  res.json({ batch: withMacros(updated), adjustment });
});
