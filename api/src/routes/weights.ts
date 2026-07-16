import { Router } from 'express';

import { requireAuth } from '../auth/requireAuth.js';
import { prisma } from '../prisma.js';

export const weightsRouter = Router();

weightsRouter.use(requireAuth);

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const isPositive = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

// POST /weights — log a reading. One entry per day: logging the same day again
// updates it (upsert), which is what a second morning weigh-in should do.
// Body: { date, weightKg, note? }
weightsRouter.post('/', async (req, res) => {
  const { date, weightKg, note } = req.body ?? {};
  if (typeof date !== 'string' || !DAY_KEY.test(date)) {
    return res.status(400).json({ error: 'date must be "YYYY-MM-DD"' });
  }
  if (!isPositive(weightKg)) {
    return res.status(400).json({ error: 'weightKg must be a positive number' });
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    return res.status(400).json({ error: 'note must be a string' });
  }

  const entry = await prisma.weightEntry.upsert({
    where: { userId_date: { userId: req.userId!, date } },
    create: { userId: req.userId!, date, weightKg, note: note ?? null },
    update: { weightKg, note: note ?? null },
  });
  res.status(201).json({ entry });
});

// GET /weights — all readings, oldest first (the chart wants chronological).
weightsRouter.get('/', async (req, res) => {
  const entries = await prisma.weightEntry.findMany({
    where: { userId: req.userId },
    orderBy: { date: 'asc' },
  });
  res.json({ entries });
});

// PATCH /weights/:id — edit a reading's value or note.
weightsRouter.patch('/:id', async (req, res) => {
  const existing = await prisma.weightEntry.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!existing) return res.status(404).json({ error: 'entry not found' });

  const { weightKg, note } = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (weightKg !== undefined) {
    if (!isPositive(weightKg)) {
      return res.status(400).json({ error: 'weightKg must be a positive number' });
    }
    data.weightKg = weightKg;
  }
  if (note !== undefined) {
    if (note !== null && typeof note !== 'string') {
      return res.status(400).json({ error: 'note must be a string' });
    }
    data.note = note;
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'nothing to update' });
  }

  const entry = await prisma.weightEntry.update({ where: { id: existing.id }, data });
  res.json({ entry });
});

// DELETE /weights/:id
weightsRouter.delete('/:id', async (req, res) => {
  const existing = await prisma.weightEntry.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!existing) return res.status(404).json({ error: 'entry not found' });

  await prisma.weightEntry.delete({ where: { id: existing.id } });
  res.status(204).end();
});
