// Suggested daily targets from a user's profile, used by onboarding (POST /tools/tdee).
// Pure maths so it can be unit-tested in isolation; the route layer handles validation
// and turning a birth date into an age. The five tracked nutrients throughout BatchFit
// are calories, protein, fat, carbs, fibre — Calories is the hero, Protein the priority.

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'build';

export type TdeeInput = {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  /** Weekly weight-change target; used for `lose`/`build`, ignored for `maintain`. */
  goalRateKgPerWk?: number;
};

export type TdeeResult = {
  bmr: number;
  maintenanceKcal: number;
  targets: {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    fibre: number;
  };
};

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Energy stored in ~1 kg of body mass; converts a weekly kg target into a daily kcal delta.
const KCAL_PER_KG = 7700;
// Protein is the prioritised macro: a fixed intake per kg of body weight.
const PROTEIN_G_PER_KG = 2.0;
// Fat as a share of total calories; carbs take whatever calories remain.
const FAT_SHARE_OF_KCAL = 0.25;
// Dietary-guideline fibre target, which scales with intake.
const FIBRE_G_PER_1000_KCAL = 14;
const KCAL_PER_G = { protein: 4, fat: 9, carbs: 4 };

const round10 = (n: number) => Math.round(n / 10) * 10;

/** Whole years elapsed from `birthDate` to `now` (defaults to today). */
export function ageFromBirthDate(birthDate: Date, now = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    now.getMonth() < birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Mifflin–St Jeor basal metabolic rate (kcal/day). */
function basalMetabolicRate(input: TdeeInput): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears;
  return input.sex === 'male' ? base + 5 : base - 161;
}

export function calculateTdee(input: TdeeInput): TdeeResult {
  const bmr = basalMetabolicRate(input);
  const maintenance = bmr * ACTIVITY_MULTIPLIERS[input.activityLevel];

  const dailyDelta = ((input.goalRateKgPerWk ?? 0) * KCAL_PER_KG) / 7;
  let targetKcal = maintenance;
  if (input.goal === 'lose') targetKcal = maintenance - dailyDelta;
  else if (input.goal === 'build') targetKcal = maintenance + dailyDelta;

  // Never suggest eating below BMR, however aggressive the deficit.
  targetKcal = round10(Math.max(targetKcal, bmr));

  const protein = input.weightKg * PROTEIN_G_PER_KG;
  const fat = (targetKcal * FAT_SHARE_OF_KCAL) / KCAL_PER_G.fat;
  const carbsKcal = targetKcal - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat;
  const carbs = Math.max(carbsKcal, 0) / KCAL_PER_G.carbs;
  const fibre = (targetKcal / 1000) * FIBRE_G_PER_1000_KCAL;

  return {
    bmr: Math.round(bmr),
    maintenanceKcal: Math.round(maintenance),
    targets: {
      kcal: targetKcal,
      protein: Math.round(protein),
      fat: Math.round(fat),
      carbs: Math.round(carbs),
      fibre: Math.round(fibre),
    },
  };
}
