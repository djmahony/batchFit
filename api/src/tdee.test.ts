import { describe, expect, it } from 'vitest';

import { ageFromBirthDate, calculateTdee, type TdeeInput } from './tdee.js';

const base: TdeeInput = {
  sex: 'male',
  ageYears: 30,
  heightCm: 180,
  weightKg: 80,
  activityLevel: 'moderate',
  goal: 'maintain',
};

describe('calculateTdee', () => {
  it('computes BMR, maintenance and targets for a weight-loss goal', () => {
    const result = calculateTdee({ ...base, goal: 'lose', goalRateKgPerWk: 0.5 });

    // Mifflin–St Jeor: 10*80 + 6.25*180 - 5*30 + 5 = 1780; ×1.55 (moderate) = 2759.
    expect(result.bmr).toBe(1780);
    expect(result.maintenanceKcal).toBe(2759);
    // 0.5 kg/wk → 550 kcal/day deficit → 2209, rounded to 2210.
    expect(result.targets.kcal).toBe(2210);
    // Protein is prioritised at 2 g/kg body weight.
    expect(result.targets.protein).toBe(160);
    expect(result.targets.fat).toBe(61);
    expect(result.targets.carbs).toBe(254);
    expect(result.targets.fibre).toBe(31);
  });

  it('adds a surplus for a build goal', () => {
    const result = calculateTdee({ ...base, goal: 'build', goalRateKgPerWk: 0.25 });

    // 0.25 kg/wk → 275 kcal/day surplus above 2759 → 3034, rounded to 3030.
    expect(result.targets.kcal).toBe(3030);
    expect(result.targets.kcal).toBeGreaterThan(result.maintenanceKcal);
  });

  it('ignores the goal rate when maintaining', () => {
    const result = calculateTdee({ ...base, goal: 'maintain', goalRateKgPerWk: 1 });

    // Maintenance 2759 rounded to 2760; the rate has no effect.
    expect(result.targets.kcal).toBe(2760);
  });

  it('never suggests eating below BMR, however aggressive the deficit', () => {
    const result = calculateTdee({
      ...base,
      activityLevel: 'sedentary',
      goal: 'lose',
      goalRateKgPerWk: 3,
    });

    expect(result.targets.kcal).toBe(result.bmr);
  });

  it('uses the female BMR constant', () => {
    const male = calculateTdee({ ...base, sex: 'male' });
    const female = calculateTdee({ ...base, sex: 'female' });

    // Same inputs, the male/female offset is +5 vs -161 → 166 kcal at BMR.
    expect(male.bmr - female.bmr).toBe(166);
  });
});

describe('ageFromBirthDate', () => {
  it('counts whole years elapsed', () => {
    expect(ageFromBirthDate(new Date('1990-01-01'), new Date('2026-07-02'))).toBe(36);
  });

  it('does not count the current year before the birthday', () => {
    expect(ageFromBirthDate(new Date('1990-12-31'), new Date('2026-07-02'))).toBe(35);
  });
});
