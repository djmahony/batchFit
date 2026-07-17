import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../prisma.js';
import { resetDb } from '../test/resetDb.js';

beforeEach(resetDb);

afterAll(async () => {
  await prisma.$disconnect();
});

const profile = {
  sex: 'male',
  birthDate: '1990-06-15',
  heightCm: 180,
  activityLevel: 'moderate',
  goal: 'lose',
  goalRateKgPerWk: 0.5,
  currentWeightKg: 90,
  units: 'metric',
  targetKcal: 2200,
  targetProtein: 180,
  targetFat: 61,
  targetCarbs: 232,
  targetFibre: 31,
};

describe('GET /today', () => {
  it('composes budget, meal subtotals, inventory and weight trend in one payload', async () => {
    const register = await request(app)
      .post('/auth/register')
      .send({ email: 'dashboard@example.com', password: 'password123' });
    const token = register.body.token as string;
    await request(app).put('/me/profile').set('Authorization', `Bearer ${token}`).send(profile);

    // Food: 200g chicken at lunch (330 kcal).
    const chicken = await prisma.food.create({
      data: { name: 'Chicken breast', kcal: 165, protein: 31, fat: 3.6, carbs: 0, fibre: 0 },
    });
    await request(app)
      .post('/diary')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-16', meal: 'lunch', foodId: chicken.id, quantity: 200 });

    // A batch with 4 portions, one eaten at dinner (575 kcal/portion).
    const batch = await request(app)
      .post('/batches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Chicken & Rice',
        portions: 4,
        ingredients: [{ foodId: chicken.id, grams: 1000 }],
      });
    await request(app)
      .post(`/batches/${batch.body.batch.id}/eat`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-16', meal: 'dinner' });

    // Two weigh-ins for the mini-trend.
    await request(app)
      .post('/weights')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-15', weightKg: 90 });
    await request(app)
      .post('/weights')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-16', weightKg: 89.6 });

    const res = await request(app)
      .get('/today')
      .query({ date: '2026-07-16' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { budget, meals, inventory, weight } = res.body.today;

    // Budget: 330 (lunch) + 412.5 (portion) consumed against 2200.
    expect(budget.consumed.kcal).toBeCloseTo(330 + 1650 / 4);
    expect(budget.targets.kcal).toBe(2200);
    expect(budget.remaining.kcal).toBeCloseTo(2200 - 330 - 1650 / 4);

    // Meal subtotals.
    expect(meals.lunch.kcal).toBeCloseTo(330);
    expect(meals.dinner.kcal).toBeCloseTo(1650 / 4);
    expect(meals.breakfast.entries).toBe(0);

    // Inventory snapshot: 3 portions left of the top batch.
    expect(inventory.mealsReady).toBe(3);
    expect(inventory.activeBatches).toBe(1);
    expect(inventory.topBatch.name).toBe('Chicken & Rice');
    expect(inventory.topBatch.perPortionMacros.kcal).toBeCloseTo(1650 / 4);

    // Weight mini-trend (EMA: 90 → 89.9).
    expect(weight.trend).toHaveLength(2);
    expect(weight.currentKg).toBeCloseTo(89.9);
    expect(weight.changeKg).toBeCloseTo(-0.1);
  });

  it('handles a fresh day: zero budget, empty meals, no inventory, no weights', async () => {
    const register = await request(app)
      .post('/auth/register')
      .send({ email: 'fresh@example.com', password: 'password123' });
    const token = register.body.token as string;

    const res = await request(app)
      .get('/today')
      .query({ date: '2026-07-16' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { budget, inventory, weight } = res.body.today;
    expect(budget.consumed.kcal).toBe(0);
    expect(budget.targets.kcal).toBeNull();
    expect(inventory.mealsReady).toBe(0);
    expect(inventory.topBatch).toBeNull();
    expect(weight.currentKg).toBeNull();
    expect(weight.trend).toEqual([]);
  });

  it('rejects a missing date and no token', async () => {
    const register = await request(app)
      .post('/auth/register')
      .send({ email: 'strict@example.com', password: 'password123' });
    const token = register.body.token as string;

    const noDate = await request(app).get('/today').set('Authorization', `Bearer ${token}`);
    expect(noDate.status).toBe(400);

    const noToken = await request(app).get('/today').query({ date: '2026-07-16' });
    expect(noToken.status).toBe(401);
  });
});
