import { Router } from 'express';

import { requireAuth } from '../auth/requireAuth.js';
import { estimateOneRepMax } from '../oneRepMax.js';
import { prisma } from '../prisma.js';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

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
export const CARDIO_MACHINES = [
  'treadmill',
  'bike',
  'rower',
  'elliptical',
  'stair_climber',
  'outdoor',
  'other',
];

const visibleTo = (userId: string) => ({ OR: [{ ownerId: null }, { ownerId: userId }] });

function validate(body: Record<string, unknown>): string | null {
  const { name, muscleGroup, equipment, trackingMode, cardioMachine } = body;
  if (typeof name !== 'string' || name.trim() === '') return 'name is required';
  if (!MUSCLE_GROUPS.includes(muscleGroup as string)) return 'muscleGroup is invalid';
  if (!EQUIPMENT.includes(equipment as string)) return 'equipment is invalid';
  if (!TRACKING_MODES.includes(trackingMode as string)) return 'trackingMode is invalid';
  if (cardioMachine !== undefined && cardioMachine !== null) {
    if (!CARDIO_MACHINES.includes(cardioMachine as string)) return 'cardioMachine is invalid';
    if (muscleGroup !== 'cardio') return 'cardioMachine is only valid on cardio exercises';
  }
  for (const key of ['videoId', 'videoQuery'] as const) {
    const value = body[key];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      return `${key} must be a string`;
    }
  }
  return null;
}

// GET /exercises — library + the caller's custom exercises; ?query= filters by
// name. ?muscleGroup= and ?cardioMachine= narrow to a picker bucket (ANDed with
// the name filter); cardioMachine=other also matches untagged cardio exercises
// so legacy rows still surface somewhere in the hierarchy.
exercisesRouter.get('/', async (req, res) => {
  const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
  const muscleGroup = typeof req.query.muscleGroup === 'string' ? req.query.muscleGroup : null;
  const cardioMachine =
    typeof req.query.cardioMachine === 'string' ? req.query.cardioMachine : null;
  if (muscleGroup !== null && !MUSCLE_GROUPS.includes(muscleGroup)) {
    return res.status(400).json({ error: 'muscleGroup is invalid' });
  }
  if (cardioMachine !== null && !CARDIO_MACHINES.includes(cardioMachine)) {
    return res.status(400).json({ error: 'cardioMachine is invalid' });
  }

  const exercises = await prisma.exercise.findMany({
    where: {
      AND: [
        visibleTo(req.userId!),
        query === '' ? {} : { name: { contains: query } },
        muscleGroup === null ? {} : { muscleGroup },
        cardioMachine === null
          ? {}
          : cardioMachine === 'other'
            ? { OR: [{ cardioMachine: 'other' }, { cardioMachine: null }] }
            : { cardioMachine },
      ],
    },
    orderBy: { name: 'asc' },
  });
  res.json({ exercises });
});

// GET /exercises/recent — the caller's most recently logged exercises, newest
// first, one row per exercise (feeds the picker's quick-pick strip). Includes
// unfinished sessions — "the thing I logged five minutes ago" is the point.
exercisesRouter.get('/recent', async (req, res) => {
  const recents = await prisma.workoutExercise.findMany({
    where: { workout: { userId: req.userId }, exerciseId: { not: null } },
    orderBy: { workout: { startedAt: 'desc' } },
    distinct: ['exerciseId'],
    take: 8,
    select: { exerciseId: true },
  });
  const ids = recents.map((r) => r.exerciseId!);
  const exercises = await prisma.exercise.findMany({
    where: { id: { in: ids }, ...visibleTo(req.userId!) },
  });
  const byId = new Map(exercises.map((e) => [e.id, e]));
  res.json({ exercises: ids.map((id) => byId.get(id)).filter(Boolean) });
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
      cardioMachine: body.cardioMachine ?? null,
      videoId: body.videoId ?? null,
      videoQuery: body.videoQuery ?? null,
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
  // A stored machine is meaningless once the exercise is no longer cardio —
  // clear it rather than failing validation on the lingering value.
  if (body.muscleGroup !== 'cardio') body.cardioMachine = null;
  const error = validate(body);
  if (error) return res.status(400).json({ error });

  const exercise = await prisma.exercise.update({
    where: { id: existing.id },
    data: {
      name: (body.name as string).trim(),
      muscleGroup: body.muscleGroup,
      equipment: body.equipment,
      trackingMode: body.trackingMode,
      cardioMachine: body.cardioMachine ?? null,
      videoId: body.videoId ?? null,
      videoQuery: body.videoQuery ?? null,
    },
  });
  res.json({ exercise });
});

const dayKeyOf = (d: Date) => d.toISOString().slice(0, 10);

// GET /exercises/:id/history — the caller's last finished session for this
// exercise plus their all-time best (per the exercise's trackingMode) and, for
// weight exercises, their heaviest manually tested 1RM. Only sets from
// *finished* workouts count — an in-progress session isn't history yet.
exercisesRouter.get('/:id/history', async (req, res) => {
  const exercise = await prisma.exercise.findFirst({
    where: { id: req.params.id, ...visibleTo(req.userId!) },
  });
  if (!exercise) return res.status(404).json({ error: 'exercise not found' });

  const finished = { userId: req.userId!, finishedAt: { not: null } };

  const lastBlock = await prisma.workoutExercise.findFirst({
    where: { exerciseId: exercise.id, workout: finished },
    orderBy: { workout: { startedAt: 'desc' } },
    include: { sets: { orderBy: { order: 'asc' } }, workout: { select: { startedAt: true } } },
  });
  const last = lastBlock
    ? {
        date: dayKeyOf(lastBlock.workout.startedAt),
        sets: lastBlock.sets.map(({ weightKg, reps, seconds, distanceM }) => ({
          weightKg,
          reps,
          seconds,
          distanceM,
        })),
      }
    : null;

  const allSets = await prisma.workoutSet.findMany({
    where: { workoutExercise: { exerciseId: exercise.id, workout: finished } },
    include: { workoutExercise: { select: { workout: { select: { startedAt: true } } } } },
  });

  type BestSet = (typeof allSets)[number];
  const pickBest = (score: (s: BestSet) => number | null) => {
    let best: BestSet | null = null;
    let bestScore = 0;
    for (const set of allSets) {
      const s = score(set);
      if (s !== null && s > bestScore) {
        best = set;
        bestScore = s;
      }
    }
    return best;
  };

  let best: Record<string, unknown> | null = null;
  if (exercise.trackingMode === 'weight_reps') {
    const top = pickBest((s) =>
      s.weightKg != null && s.reps != null ? estimateOneRepMax(s.weightKg, s.reps) : null,
    );
    if (top) {
      best = {
        weightKg: top.weightKg,
        reps: top.reps,
        estimatedOneRepMax: estimateOneRepMax(top.weightKg!, top.reps!),
        date: dayKeyOf(top.workoutExercise.workout.startedAt),
      };
    }
  } else if (exercise.trackingMode === 'bodyweight_reps') {
    const top = pickBest((s) => s.reps);
    if (top) best = { reps: top.reps, date: dayKeyOf(top.workoutExercise.workout.startedAt) };
  } else if (exercise.trackingMode === 'time') {
    const top = pickBest((s) => s.seconds);
    if (top) best = { seconds: top.seconds, date: dayKeyOf(top.workoutExercise.workout.startedAt) };
  } else {
    // distance — "best" means longest, not fastest pace (deliberate MVP rule).
    const top = pickBest((s) => s.distanceM);
    if (top) {
      best = {
        distanceM: top.distanceM,
        seconds: top.seconds,
        date: dayKeyOf(top.workoutExercise.workout.startedAt),
      };
    }
  }

  let testedMax: { weightKg: number; date: string } | null = null;
  if (exercise.trackingMode === 'weight_reps') {
    const top = await prisma.oneRepMaxEntry.findFirst({
      where: { userId: req.userId!, exerciseId: exercise.id },
      orderBy: [{ weightKg: 'desc' }, { date: 'desc' }],
    });
    if (top) testedMax = { weightKg: top.weightKg, date: top.date };
  }

  // Video fields ride along so the session screen's "watch form video" link
  // works for blocks restored on resume (which only carry the exercise id).
  res.json({ last, best, testedMax, videoId: exercise.videoId, videoQuery: exercise.videoQuery });
});

// POST /exercises/:id/one-rep-max — record an actually-tested 1RM for a
// weight_reps exercise. Body: { weightKg, date? } (date defaults to today).
exercisesRouter.post('/:id/one-rep-max', async (req, res) => {
  const exercise = await prisma.exercise.findFirst({
    where: { id: req.params.id, ...visibleTo(req.userId!) },
  });
  if (!exercise) return res.status(404).json({ error: 'exercise not found' });
  if (exercise.trackingMode !== 'weight_reps') {
    return res.status(400).json({ error: 'one-rep max only applies to weight exercises' });
  }

  const { weightKg, date } = req.body ?? {};
  if (typeof weightKg !== 'number' || !Number.isFinite(weightKg) || weightKg <= 0) {
    return res.status(400).json({ error: 'weightKg must be a positive number' });
  }
  if (date !== undefined && (typeof date !== 'string' || !DAY_KEY.test(date))) {
    return res.status(400).json({ error: 'date must be "YYYY-MM-DD"' });
  }

  const entry = await prisma.oneRepMaxEntry.create({
    data: {
      userId: req.userId!,
      exerciseId: exercise.id,
      weightKg,
      date: date ?? dayKeyOf(new Date()),
    },
  });
  res.status(201).json({ entry });
});

// DELETE /exercises/one-rep-max/:entryId — remove one of the caller's own
// tested-max entries (mis-taps happen).
exercisesRouter.delete('/one-rep-max/:entryId', async (req, res) => {
  const entry = await prisma.oneRepMaxEntry.findFirst({
    where: { id: req.params.entryId, userId: req.userId },
  });
  if (!entry) return res.status(404).json({ error: 'entry not found' });

  await prisma.oneRepMaxEntry.delete({ where: { id: entry.id } });
  res.status(204).end();
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
