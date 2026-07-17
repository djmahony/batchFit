import { Router } from 'express';

import { requireAuth } from '../auth/requireAuth.js';
import { prisma } from '../prisma.js';
import { serializeUser } from '../serializers.js';

export const meRouter = Router();

// GET /me — the current user (profile, targets, onboardingComplete).
meRouter.get('/', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user: serializeUser(user) });
});

// SQLite has no enums; these mirror the choice fields documented on the Prisma schema.
const SEXES = ['male', 'female'];
const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const GOALS = ['lose', 'maintain', 'build'];
const UNITS = ['metric', 'imperial'];

const isPositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

// PUT /me/profile — save what onboarding produced: goal, profile, and the five
// daily targets (weight/height already converted to metric by the client).
// Completing this marks onboarding done.
meRouter.put('/profile', requireAuth, async (req, res) => {
  const {
    sex,
    birthDate,
    heightCm,
    activityLevel,
    goal,
    goalRateKgPerWk,
    currentWeightKg,
    goalWeightKg,
    units,
    targetKcal,
    targetProtein,
    targetFat,
    targetCarbs,
    targetFibre,
  } = req.body ?? {};

  if (!SEXES.includes(sex)) {
    return res.status(400).json({ error: 'sex must be "male" or "female"' });
  }
  if (!ACTIVITY_LEVELS.includes(activityLevel)) {
    return res.status(400).json({ error: 'activityLevel is invalid' });
  }
  if (!GOALS.includes(goal)) {
    return res.status(400).json({ error: 'goal must be "lose", "maintain" or "build"' });
  }
  if (!UNITS.includes(units)) {
    return res.status(400).json({ error: 'units must be "metric" or "imperial"' });
  }
  if (!isPositive(heightCm) || !isPositive(currentWeightKg)) {
    return res
      .status(400)
      .json({ error: 'heightCm and currentWeightKg must be positive numbers' });
  }
  if (goalWeightKg !== undefined && goalWeightKg !== null && !isPositive(goalWeightKg)) {
    return res.status(400).json({ error: 'goalWeightKg must be a positive number' });
  }
  if (goal !== 'maintain' && !isPositive(goalRateKgPerWk)) {
    return res
      .status(400)
      .json({ error: 'goalRateKgPerWk must be a positive number for lose/build goals' });
  }

  const birth = new Date(birthDate);
  if (typeof birthDate !== 'string' || Number.isNaN(birth.getTime())) {
    return res.status(400).json({ error: 'birthDate must be a valid date' });
  }

  const targets = { targetKcal, targetProtein, targetFat, targetCarbs, targetFibre };
  for (const [name, value] of Object.entries(targets)) {
    if (!isPositive(value)) {
      return res.status(400).json({ error: `${name} must be a positive number` });
    }
  }

  const existing = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!existing) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      sex,
      birthDate: birth,
      heightCm,
      activityLevel,
      goal,
      goalRateKgPerWk: goal === 'maintain' ? null : goalRateKgPerWk,
      currentWeightKg,
      goalWeightKg: goalWeightKg ?? null,
      units,
      targetKcal,
      targetProtein,
      targetFat,
      targetCarbs,
      targetFibre,
      onboardingComplete: true,
    },
  });

  res.json({ user: serializeUser(user) });
});

// PATCH /me/profile — Settings edits: any subset of goal / profile / units /
// targets. Each provided field is validated like the PUT; switching to a
// maintain goal nulls the weekly rate. Onboarding state is untouched.
meRouter.patch('/profile', requireAuth, async (req, res) => {
  const body = req.body ?? {};
  const data: Record<string, unknown> = {};

  if (body.sex !== undefined) {
    if (!SEXES.includes(body.sex)) {
      return res.status(400).json({ error: 'sex must be "male" or "female"' });
    }
    data.sex = body.sex;
  }
  if (body.activityLevel !== undefined) {
    if (!ACTIVITY_LEVELS.includes(body.activityLevel)) {
      return res.status(400).json({ error: 'activityLevel is invalid' });
    }
    data.activityLevel = body.activityLevel;
  }
  if (body.goal !== undefined) {
    if (!GOALS.includes(body.goal)) {
      return res.status(400).json({ error: 'goal must be "lose", "maintain" or "build"' });
    }
    data.goal = body.goal;
    if (body.goal === 'maintain') data.goalRateKgPerWk = null;
  }
  if (body.units !== undefined) {
    if (!UNITS.includes(body.units)) {
      return res.status(400).json({ error: 'units must be "metric" or "imperial"' });
    }
    data.units = body.units;
  }
  if (body.birthDate !== undefined) {
    const birth = new Date(body.birthDate);
    if (typeof body.birthDate !== 'string' || Number.isNaN(birth.getTime())) {
      return res.status(400).json({ error: 'birthDate must be a valid date' });
    }
    data.birthDate = birth;
  }
  for (const field of [
    'heightCm',
    'currentWeightKg',
    'goalRateKgPerWk',
    'targetKcal',
    'targetProtein',
    'targetFat',
    'targetCarbs',
    'targetFibre',
  ] as const) {
    if (body[field] !== undefined) {
      if (!isPositive(body[field])) {
        return res.status(400).json({ error: `${field} must be a positive number` });
      }
      data[field] = body[field];
    }
  }
  if (body.goalWeightKg !== undefined) {
    if (body.goalWeightKg !== null && !isPositive(body.goalWeightKg)) {
      return res.status(400).json({ error: 'goalWeightKg must be a positive number' });
    }
    data.goalWeightKg = body.goalWeightKg;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'nothing to update' });
  }

  const existing = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!existing) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = await prisma.user.update({ where: { id: req.userId }, data });
  res.json({ user: serializeUser(user) });
});
