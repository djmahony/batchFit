import { Router } from 'express';

import { requireAuth } from '../auth/requireAuth.js';
import { prisma } from '../prisma.js';

export const exercisesRouter = Router();

exercisesRouter.use(requireAuth);

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'full_body',
  'cardio',
];
export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'other',
];
export const TRACKING_MODES = ['weight_reps', 'bodyweight_reps', 'time', 'distance'];

const visibleTo = (userId: string) => ({ OR: [{ ownerId: null }, { ownerId: userId }] });

function validate(body: Record<string, unknown>): string | null {
  const { name, muscleGroup, equipment, trackingMode } = body;
  if (typeof name !== 'string' || name.trim() === '') return 'name is required';
  if (!MUSCLE_GROUPS.includes(muscleGroup as string)) return 'muscleGroup is invalid';
  if (!EQUIPMENT.includes(equipment as string)) return 'equipment is invalid';
  if (!TRACKING_MODES.includes(trackingMode as string)) return 'trackingMode is invalid';
  return null;
}

// GET /exercises — library + the caller's custom exercises; ?query= filters by name.
exercisesRouter.get('/', async (req, res) => {
  const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
  const exercises = await prisma.exercise.findMany({
    where: {
      AND: [visibleTo(req.userId!), query === '' ? {} : { name: { contains: query } }],
    },
    orderBy: { name: 'asc' },
  });
  res.json({ exercises });
});

// POST /exercises — create a custom exercise owned by the caller.
exercisesRouter.post('/', async (req, res) => {
  const body = req.body ?? {};
  const error = validate(body);
  if (error) return res.status(400).json({ error });

  const exercise = await prisma.exercise.create({
    data: {
      name: (body.name as string).trim(),
      muscleGroup: body.muscleGroup,
      equipment: body.equipment,
      trackingMode: body.trackingMode,
      ownerId: req.userId!,
    },
  });
  res.status(201).json({ exercise });
});

// PATCH /exercises/:id — edit one of the caller's own exercises (not the library).
exercisesRouter.patch('/:id', async (req, res) => {
  const existing = await prisma.exercise.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
  });
  if (!existing) return res.status(404).json({ error: 'exercise not found' });

  const body = { ...existing, ...(req.body ?? {}) };
  const error = validate(body);
  if (error) return res.status(400).json({ error });

  const exercise = await prisma.exercise.update({
    where: { id: existing.id },
    data: {
      name: (body.name as string).trim(),
      muscleGroup: body.muscleGroup,
      equipment: body.equipment,
      trackingMode: body.trackingMode,
    },
  });
  res.json({ exercise });
});

// DELETE /exercises/:id — remove one of the caller's own exercises.
exercisesRouter.delete('/:id', async (req, res) => {
  const existing = await prisma.exercise.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
  });
  if (!existing) return res.status(404).json({ error: 'exercise not found' });

  await prisma.exercise.delete({ where: { id: existing.id } });
  res.status(204).end();
});
