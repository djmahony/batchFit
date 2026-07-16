import { Router } from 'express';

import { requireAuth } from '../auth/requireAuth.js';
import { prisma } from '../prisma.js';

export const workoutsRouter = Router();

workoutsRouter.use(requireAuth);

const workoutInclude = {
  exercises: {
    orderBy: { order: 'asc' },
    include: { sets: { orderBy: { order: 'asc' } } },
  },
} as const;

type SetInput = {
  weightKg?: number | null;
  reps?: number | null;
  seconds?: number | null;
  distanceM?: number | null;
};
type ExerciseInput = { exerciseId: string; sets: SetInput[] };

const isNonNegative = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

function validateSet(set: SetInput): string | null {
  for (const key of ['weightKg', 'distanceM'] as const) {
    const value = set?.[key];
    if (value !== undefined && value !== null && !isNonNegative(value)) {
      return `${key} must be a non-negative number`;
    }
  }
  for (const key of ['reps', 'seconds'] as const) {
    const value = set?.[key];
    if (value !== undefined && value !== null && (!isNonNegative(value) || !Number.isInteger(value))) {
      return `${key} must be a non-negative integer`;
    }
  }
  return null;
}

// POST /workouts — start a session. If an unfinished one exists it's returned
// instead (200), so a double-tap or app restart never forks the workout.
workoutsRouter.post('/', async (req, res) => {
  const existing = await prisma.workout.findFirst({
    where: { userId: req.userId, finishedAt: null },
    include: workoutInclude,
  });
  if (existing) return res.status(200).json({ workout: existing });

  const workout = await prisma.workout.create({
    data: { userId: req.userId! },
    include: workoutInclude,
  });
  res.status(201).json({ workout });
});

// GET /workouts — history, newest first. ?status=unfinished|finished filters.
workoutsRouter.get('/', async (req, res) => {
  const status = req.query.status;
  if (status !== undefined && status !== 'unfinished' && status !== 'finished') {
    return res.status(400).json({ error: 'status must be "unfinished" or "finished"' });
  }

  const workouts = await prisma.workout.findMany({
    where: {
      userId: req.userId,
      ...(status === 'unfinished' ? { finishedAt: null } : {}),
      ...(status === 'finished' ? { finishedAt: { not: null } } : {}),
    },
    include: workoutInclude,
    orderBy: { startedAt: 'desc' },
  });
  res.json({ workouts });
});

// GET /workouts/last — the most recent finished session, for "repeat last
// workout": the client pre-fills a new session from its blocks + sets.
// Declared before /:id so "last" isn't treated as an id.
workoutsRouter.get('/last', async (req, res) => {
  const workout = await prisma.workout.findFirst({
    where: { userId: req.userId, finishedAt: { not: null } },
    include: workoutInclude,
    orderBy: { startedAt: 'desc' },
  });
  if (!workout) return res.status(404).json({ error: 'no finished workouts yet' });
  res.json({ workout });
});

// GET /workouts/:id
workoutsRouter.get('/:id', async (req, res) => {
  const workout = await prisma.workout.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: workoutInclude,
  });
  if (!workout) return res.status(404).json({ error: 'workout not found' });
  res.json({ workout });
});

// PUT /workouts/:id — replace the session's blocks + sets in one go (the app
// saves the whole session as it's edited). Exercise name + trackingMode are
// snapshotted from the exercise, which must be visible to the caller.
// Body: { exercises: [{ exerciseId, sets: [{ weightKg?, reps?, seconds?, distanceM? }] }] }
workoutsRouter.put('/:id', async (req, res) => {
  const workout = await prisma.workout.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!workout) return res.status(404).json({ error: 'workout not found' });

  const { exercises } = req.body ?? {};
  if (!Array.isArray(exercises)) {
    return res.status(400).json({ error: 'exercises must be an array' });
  }
  for (const block of exercises as ExerciseInput[]) {
    if (typeof block?.exerciseId !== 'string' || block.exerciseId === '') {
      return res.status(400).json({ error: 'every exercise block needs an exerciseId' });
    }
    if (!Array.isArray(block.sets)) {
      return res.status(400).json({ error: 'every exercise block needs a sets array' });
    }
    for (const set of block.sets) {
      const error = validateSet(set);
      if (error) return res.status(400).json({ error });
    }
  }

  const exerciseIds = [...new Set((exercises as ExerciseInput[]).map((b) => b.exerciseId))];
  const visible = await prisma.exercise.findMany({
    where: { id: { in: exerciseIds }, OR: [{ ownerId: null }, { ownerId: req.userId }] },
  });
  if (visible.length !== exerciseIds.length) {
    return res.status(404).json({ error: 'exercise not found' });
  }
  const byId = new Map(visible.map((e) => [e.id, e]));

  const [, updated] = await prisma.$transaction([
    prisma.workoutExercise.deleteMany({ where: { workoutId: workout.id } }),
    prisma.workout.update({
      where: { id: workout.id },
      data: {
        exercises: {
          create: (exercises as ExerciseInput[]).map((block, blockIndex) => {
            const exercise = byId.get(block.exerciseId)!;
            return {
              exerciseId: exercise.id,
              name: exercise.name,
              trackingMode: exercise.trackingMode,
              order: blockIndex,
              sets: {
                create: block.sets.map((set, setIndex) => ({
                  order: setIndex,
                  weightKg: set.weightKg ?? null,
                  reps: set.reps ?? null,
                  seconds: set.seconds ?? null,
                  distanceM: set.distanceM ?? null,
                })),
              },
            };
          }),
        },
      },
      include: workoutInclude,
    }),
  ]);
  res.json({ workout: updated });
});

// POST /workouts/:id/finish — close the session.
workoutsRouter.post('/:id/finish', async (req, res) => {
  const workout = await prisma.workout.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!workout) return res.status(404).json({ error: 'workout not found' });
  if (workout.finishedAt) return res.status(409).json({ error: 'workout already finished' });

  const finished = await prisma.workout.update({
    where: { id: workout.id },
    data: { finishedAt: new Date() },
    include: workoutInclude,
  });
  res.json({ workout: finished });
});

// DELETE /workouts/:id — discard a session (unfinished or historical).
workoutsRouter.delete('/:id', async (req, res) => {
  const workout = await prisma.workout.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!workout) return res.status(404).json({ error: 'workout not found' });

  await prisma.workout.delete({ where: { id: workout.id } });
  res.status(204).end();
});
