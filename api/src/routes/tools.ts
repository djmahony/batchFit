import { Router } from 'express';

import { requireAuth } from '../auth/requireAuth.js';
import {
  ageFromBirthDate,
  calculateTdee,
  type ActivityLevel,
  type Goal,
  type Sex,
} from '../tdee.js';

export const toolsRouter = Router();

const SEXES: Sex[] = ['male', 'female'];
const ACTIVITY_LEVELS: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
];
const GOALS: Goal[] = ['lose', 'maintain', 'build'];

const isPositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

// POST /tools/tdee — suggested daily targets from onboarding's profile inputs.
// Inputs come from the request body (the onboarding flow), not the stored profile.
toolsRouter.post('/tdee', requireAuth, (req, res) => {
  const { sex, birthDate, heightCm, weightKg, activityLevel, goal, goalRateKgPerWk } =
    req.body ?? {};

  if (!SEXES.includes(sex)) {
    return res.status(400).json({ error: 'sex must be "male" or "female"' });
  }
  if (!ACTIVITY_LEVELS.includes(activityLevel)) {
    return res.status(400).json({ error: 'activityLevel is invalid' });
  }
  if (!GOALS.includes(goal)) {
    return res.status(400).json({ error: 'goal must be "lose", "maintain" or "build"' });
  }
  if (!isPositive(heightCm) || !isPositive(weightKg)) {
    return res.status(400).json({ error: 'heightCm and weightKg must be positive numbers' });
  }

  const birth = new Date(birthDate);
  if (typeof birthDate !== 'string' || Number.isNaN(birth.getTime())) {
    return res.status(400).json({ error: 'birthDate must be a valid date' });
  }
  const ageYears = ageFromBirthDate(birth);
  if (ageYears < 13 || ageYears > 120) {
    return res.status(400).json({ error: 'birthDate must give an age between 13 and 120' });
  }

  // A weekly rate is required to size the deficit/surplus for lose/build goals.
  if (goal !== 'maintain' && !isPositive(goalRateKgPerWk)) {
    return res
      .status(400)
      .json({ error: 'goalRateKgPerWk must be a positive number for lose/build goals' });
  }

  const result = calculateTdee({
    sex,
    ageYears,
    heightCm,
    weightKg,
    activityLevel,
    goal,
    goalRateKgPerWk,
  });

  res.json(result);
});
