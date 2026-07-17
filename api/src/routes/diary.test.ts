import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../prisma.js';
import { resetDb } from '../test/resetDb.js';

beforeEach(resetDb);

afterAll(async () => {
  await prisma.$disconnect();
});

async function registerAndGetToken(email = 'diarist@example.com') {
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  return res.body.token as string;
}

// Chicken breast per 100g.
const chickenMacros = { kcal: 165, protein: 31, fat: 3.6, carbs: 0, fibre: 0 };

async function seedChicken() {
  return prisma.food.create({ data: { name: 'Chicken breast', ...chickenMacros } });
}

describe('POST /diary', () => {
  it('logs a food with macros scaled to the quantity and snapshotted', async () => {
    const token = await registerAndGetToken();
    const chicken = await seedChicken();

    const res = await request(app)
      .post('/diary')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-15', meal: 'lunch', foodId: chicken.id, quantity: 200 });

    expect(res.status).toBe(201);
    expect(res.body.entry.name).toBe('Chicken breast');
    expect(res.body.entry.meal).toBe('lunch');
    expect(res.body.entry.quantity).toBe(200);
    expect(res.body.entry.kcal).toBeCloseTo(330);
    expect(res.body.entry.protein).toBeCloseTo(62);

    // Editing the food afterwards must not rewrite the logged entry.
    await prisma.food.update({ where: { id: chicken.id }, data: { kcal: 999 } });
    const day = await request(app)
      .get('/diary')
      .query({ date: '2026-07-15' })
      .set('Authorization', `Bearer ${token}`);
    expect(day.body.entries[0].kcal).toBeCloseTo(330);
  });

  it("rejects logging another user's custom food with 404", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    const create = await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Secret sauce', ...chickenMacros });

    const res = await request(app)
      .post('/diary')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-15', meal: 'dinner', foodId: create.body.food.id, quantity: 100 });

    expect(res.status).toBe(404);
  });

  it('rejects a bad date, meal or quantity with 400', async () => {
    const token = await registerAndGetToken();
    const chicken = await seedChicken();
    const valid = { date: '2026-07-15', meal: 'lunch', foodId: chicken.id, quantity: 100 };

    for (const bad of [
      { ...valid, date: '15/07/2026' },
      { ...valid, meal: 'elevenses' },
      { ...valid, quantity: 0 },
      { ...valid, foodId: undefined },
    ]) {
      const res = await request(app).post('/diary').set('Authorization', `Bearer ${token}`).send(bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
  });

  it('rejects a request with no token with 401', async () => {
    const res = await request(app).post('/diary').send({});
    expect(res.status).toBe(401);
  });
});

describe('GET /diary', () => {
  it("returns only the caller's entries for the requested day", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    const chicken = await seedChicken();

    const log = (t: string, date: string) =>
      request(app)
        .post('/diary')
        .set('Authorization', `Bearer ${t}`)
        .send({ date, meal: 'breakfast', foodId: chicken.id, quantity: 100 });

    await log(token, '2026-07-15');
    await log(token, '2026-07-16'); // other day
    await log(otherToken, '2026-07-15'); // other user

    const res = await request(app)
      .get('/diary')
      .query({ date: '2026-07-15' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0].date).toBe('2026-07-15');
  });

  it('rejects a missing/invalid date with 400', async () => {
    const token = await registerAndGetToken();
    const res = await request(app).get('/diary').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /diary/summary', () => {
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

  it('returns consumed vs. targets with remaining for the five nutrients', async () => {
    const token = await registerAndGetToken();
    await request(app).put('/me/profile').set('Authorization', `Bearer ${token}`).send(profile);
    const chicken = await seedChicken();

    // 200g at breakfast + 100g at dinner = 300g chicken.
    for (const [meal, quantity] of [
      ['breakfast', 200],
      ['dinner', 100],
    ] as const) {
      await request(app)
        .post('/diary')
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-07-15', meal, foodId: chicken.id, quantity });
    }

    const res = await request(app)
      .get('/diary/summary')
      .query({ date: '2026-07-15' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { consumed, targets, remaining } = res.body.summary;
    expect(consumed.kcal).toBeCloseTo(495);
    expect(consumed.protein).toBeCloseTo(93);
    expect(targets.kcal).toBe(2200);
    expect(remaining.kcal).toBeCloseTo(1705);
    expect(remaining.protein).toBeCloseTo(87);
    expect(remaining.fibre).toBeCloseTo(31);
  });

  it('updates after an entry is edited or deleted', async () => {
    const token = await registerAndGetToken();
    await request(app).put('/me/profile').set('Authorization', `Bearer ${token}`).send(profile);
    const chicken = await seedChicken();
    const created = await request(app)
      .post('/diary')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-15', meal: 'lunch', foodId: chicken.id, quantity: 200 });

    await request(app)
      .patch(`/diary/${created.body.entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 100 });
    let res = await request(app)
      .get('/diary/summary')
      .query({ date: '2026-07-15' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.summary.consumed.kcal).toBeCloseTo(165);

    await request(app)
      .delete(`/diary/${created.body.entry.id}`)
      .set('Authorization', `Bearer ${token}`);
    res = await request(app)
      .get('/diary/summary')
      .query({ date: '2026-07-15' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.summary.consumed.kcal).toBe(0);
  });

  it('returns null targets/remaining before onboarding sets them', async () => {
    const token = await registerAndGetToken();

    const res = await request(app)
      .get('/diary/summary')
      .query({ date: '2026-07-15' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.consumed.kcal).toBe(0);
    expect(res.body.summary.targets.kcal).toBeNull();
    expect(res.body.summary.remaining.kcal).toBeNull();
  });

  it('rejects a missing date with 400', async () => {
    const token = await registerAndGetToken();
    const res = await request(app).get('/diary/summary').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /diary/:id', () => {
  it("returns the caller's entry and 404s for someone else's", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    const chicken = await seedChicken();
    const created = await request(app)
      .post('/diary')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-15', meal: 'lunch', foodId: chicken.id, quantity: 150 });

    const own = await request(app)
      .get(`/diary/${created.body.entry.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(own.status).toBe(200);
    expect(own.body.entry.quantity).toBe(150);

    const foreign = await request(app)
      .get(`/diary/${created.body.entry.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(foreign.status).toBe(404);
  });
});

describe('PATCH /diary/:id', () => {
  it('rescales snapshotted macros when quantity changes', async () => {
    const token = await registerAndGetToken();
    const chicken = await seedChicken();
    const created = await request(app)
      .post('/diary')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-15', meal: 'lunch', foodId: chicken.id, quantity: 200 });

    const res = await request(app)
      .patch(`/diary/${created.body.entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 100 });

    expect(res.status).toBe(200);
    expect(res.body.entry.quantity).toBe(100);
    expect(res.body.entry.kcal).toBeCloseTo(165);
    expect(res.body.entry.protein).toBeCloseTo(31);
  });

  it('moves an entry between meals', async () => {
    const token = await registerAndGetToken();
    const chicken = await seedChicken();
    const created = await request(app)
      .post('/diary')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-15', meal: 'lunch', foodId: chicken.id, quantity: 100 });

    const res = await request(app)
      .patch(`/diary/${created.body.entry.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ meal: 'dinner' });

    expect(res.status).toBe(200);
    expect(res.body.entry.meal).toBe('dinner');
  });

  it("404s for another user's entry", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    const chicken = await seedChicken();
    const created = await request(app)
      .post('/diary')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-15', meal: 'lunch', foodId: chicken.id, quantity: 100 });

    const res = await request(app)
      .patch(`/diary/${created.body.entry.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ quantity: 50 });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /diary/:id', () => {
  it('deletes an entry', async () => {
    const token = await registerAndGetToken();
    const chicken = await seedChicken();
    const created = await request(app)
      .post('/diary')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-15', meal: 'lunch', foodId: chicken.id, quantity: 100 });

    const res = await request(app)
      .delete(`/diary/${created.body.entry.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const day = await request(app)
      .get('/diary')
      .query({ date: '2026-07-15' })
      .set('Authorization', `Bearer ${token}`);
    expect(day.body.entries).toHaveLength(0);
  });

  it("404s for another user's entry", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    const chicken = await seedChicken();
    const created = await request(app)
      .post('/diary')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-15', meal: 'lunch', foodId: chicken.id, quantity: 100 });

    const res = await request(app)
      .delete(`/diary/${created.body.entry.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });
});
