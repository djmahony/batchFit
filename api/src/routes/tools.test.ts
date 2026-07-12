import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../prisma.js';

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /tools/tdee', () => {
  const profile = {
    sex: 'male',
    birthDate: '1990-01-01',
    heightCm: 180,
    weightKg: 80,
    activityLevel: 'moderate',
    goal: 'lose',
    goalRateKgPerWk: 0.5,
  };

  async function registerAndGetToken() {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'member@example.com', password: 'password123' });
    return res.body.token as string;
  }

  it('returns suggested targets for a valid profile', async () => {
    const token = await registerAndGetToken();

    const res = await request(app)
      .post('/tools/tdee')
      .set('Authorization', `Bearer ${token}`)
      .send(profile);

    // Exact maths (incl. age handling) is pinned in tdee.test.ts; here we assert the
    // wired-up shape and that a lose goal lands below maintenance. Age derives from
    // birthDate at request time, so absolute kcal is left to the unit test.
    expect(res.status).toBe(200);
    expect(res.body.bmr).toBeGreaterThan(0);
    expect(res.body.maintenanceKcal).toBeGreaterThan(res.body.bmr);
    expect(res.body.targets.kcal).toBeLessThan(res.body.maintenanceKcal);
    expect(res.body.targets.protein).toBe(160); // 2 g/kg of 80 kg, independent of age
    expect(Object.keys(res.body.targets).sort()).toEqual([
      'carbs',
      'fat',
      'fibre',
      'kcal',
      'protein',
    ]);
  });

  it('requires a token', async () => {
    const res = await request(app).post('/tools/tdee').send(profile);

    expect(res.status).toBe(401);
  });

  it('rejects an invalid profile with 400', async () => {
    const token = await registerAndGetToken();

    const res = await request(app)
      .post('/tools/tdee')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...profile, sex: 'other' });

    expect(res.status).toBe(400);
  });

  it('requires a goal rate for a lose/build goal', async () => {
    const token = await registerAndGetToken();

    const res = await request(app)
      .post('/tools/tdee')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...profile, goalRateKgPerWk: undefined });

    expect(res.status).toBe(400);
  });
});
