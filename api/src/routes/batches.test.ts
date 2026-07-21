import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../prisma.js';
import { resetDb } from '../test/resetDb.js';

beforeEach(resetDb);

afterAll(async () => {
  await prisma.$disconnect();
});

async function registerAndGetToken(email = 'cook@example.com') {
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  return res.body.token as string;
}

async function seedFoods() {
  const chicken = await prisma.food.create({
    data: { name: 'Chicken breast', kcal: 165, protein: 31, fat: 3.6, carbs: 0, fibre: 0 },
  });
  const rice = await prisma.food.create({
    data: { name: 'Cooked white rice', kcal: 130, protein: 2.7, fat: 0.3, carbs: 28, fibre: 0.4 },
  });
  return { chicken, rice };
}

async function createBatch(token: string, overrides: Record<string, unknown> = {}) {
  const { chicken, rice } = await seedFoods();
  return request(app)
    .post('/batches')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Chicken & Rice',
      portions: 4,
      ingredients: [
        { foodId: chicken.id, grams: 1000 },
        { foodId: rice.id, grams: 500 },
      ],
      ...overrides,
    });
}

describe('POST /batches', () => {
  it('creates an owned batch with total + per-portion macros', async () => {
    const token = await registerAndGetToken();

    const res = await createBatch(token);

    expect(res.status).toBe(201);
    const { batch } = res.body;
    expect(batch.portionsTotal).toBe(4);
    expect(batch.portionsRemaining).toBe(4);
    // 1000g chicken (1650 kcal) + 500g rice (650 kcal) = 2300 kcal → 575/portion.
    expect(batch.totalMacros.kcal).toBeCloseTo(2300);
    expect(batch.perPortionMacros.kcal).toBeCloseTo(575);
    expect(batch.perPortionMacros.protein).toBeCloseTo((310 + 13.5) / 4);
  });

  it('rejects bad portions or ingredients with 400', async () => {
    const token = await registerAndGetToken();
    const { chicken } = await seedFoods();

    for (const bad of [
      { portions: 0 },
      { portions: 2.5 },
      { ingredients: [] },
      { ingredients: [{ foodId: chicken.id, grams: 0 }] },
      { ingredients: [{ grams: 100 }] },
    ]) {
      const res = await request(app)
        .post('/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X', portions: 4, ingredients: [{ foodId: chicken.id, grams: 100 }], ...bad });
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
  });

  it("404s when an ingredient uses another user's custom food", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    const foreign = await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Secret spice mix', kcal: 100, protein: 1, fat: 1, carbs: 20, fibre: 1 });

    const res = await request(app)
      .post('/batches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Sneaky batch',
        portions: 2,
        ingredients: [{ foodId: foreign.body.food.id, grams: 100 }],
      });

    expect(res.status).toBe(404);
  });

  it('rejects a request with no token with 401', async () => {
    const res = await request(app).post('/batches').send({});
    expect(res.status).toBe(401);
  });
});

describe('GET /batches', () => {
  it("lists only the caller's batches", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    await createBatch(token, { name: 'Mine' });
    await createBatch(otherToken, { name: 'Theirs' });

    const res = await request(app).get('/batches').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.batches).toHaveLength(1);
    expect(res.body.batches[0].name).toBe('Mine');
  });
});

describe('GET /batches/:id', () => {
  it("404s for another user's batch", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    const created = await createBatch(token);

    const own = await request(app)
      .get(`/batches/${created.body.batch.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(own.status).toBe(200);

    const foreign = await request(app)
      .get(`/batches/${created.body.batch.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(foreign.status).toBe(404);
  });
});

describe('GET /batches?status=', () => {
  it('splits active inventory from depleted history', async () => {
    const token = await registerAndGetToken();
    await createBatch(token, { name: 'Still going', portions: 2 });
    const depleted = await createBatch(token, { name: 'All gone', portions: 1 });
    await request(app)
      .post(`/batches/${depleted.body.batch.id}/eat`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-16', meal: 'lunch' });

    const activeRes = await request(app)
      .get('/batches')
      .query({ status: 'active' })
      .set('Authorization', `Bearer ${token}`);
    expect(activeRes.body.batches.map((b: { name: string }) => b.name)).toEqual(['Still going']);

    const depletedRes = await request(app)
      .get('/batches')
      .query({ status: 'depleted' })
      .set('Authorization', `Bearer ${token}`);
    expect(depletedRes.body.batches.map((b: { name: string }) => b.name)).toEqual(['All gone']);
  });

  it('rejects an unknown status with 400', async () => {
    const token = await registerAndGetToken();
    const res = await request(app)
      .get('/batches')
      .query({ status: 'gone-off' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('PATCH /batches/:id', () => {
  it('adjusts portions remaining within 0..total', async () => {
    const token = await registerAndGetToken();
    const created = await createBatch(token, { portions: 6 });
    const id = created.body.batch.id;

    const res = await request(app)
      .patch(`/batches/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ portionsRemaining: 2 });

    expect(res.status).toBe(200);
    expect(res.body.batch.portionsRemaining).toBe(2);

    for (const bad of [-1, 7, 1.5, 'three']) {
      const badRes = await request(app)
        .patch(`/batches/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ portionsRemaining: bad });
      expect(badRes.status, String(bad)).toBe(400);
    }
  });

  it("404s for another user's batch", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    const created = await createBatch(token);

    const res = await request(app)
      .patch(`/batches/${created.body.batch.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ portionsRemaining: 1 });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /batches/:id', () => {
  it('deletes the batch but keeps diary entries eaten from it', async () => {
    const token = await registerAndGetToken();
    const created = await createBatch(token, { portions: 3 });
    const id = created.body.batch.id;
    await request(app)
      .post(`/batches/${id}/eat`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-16', meal: 'dinner' });

    const res = await request(app)
      .delete(`/batches/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const list = await request(app).get('/batches').set('Authorization', `Bearer ${token}`);
    expect(list.body.batches).toHaveLength(0);

    // The eaten portion is still in the diary, snapshot intact.
    const day = await request(app)
      .get('/diary')
      .query({ date: '2026-07-16' })
      .set('Authorization', `Bearer ${token}`);
    expect(day.body.entries).toHaveLength(1);
    expect(day.body.entries[0].kcal).toBeCloseTo(2300 / 3);
  });

  it("404s for another user's batch", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    const created = await createBatch(token);

    const res = await request(app)
      .delete(`/batches/${created.body.batch.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /batches/:id/eat', () => {
  it('logs a per-portion diary entry and decrements the count', async () => {
    const token = await registerAndGetToken();
    const created = await createBatch(token, { portions: 4 });

    const res = await request(app)
      .post(`/batches/${created.body.batch.id}/eat`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-16', meal: 'lunch' });

    expect(res.status).toBe(200);
    expect(res.body.batch.portionsRemaining).toBe(3);
    // 2300 kcal batch ÷ 4 portions = 575 kcal snapshotted on the entry.
    expect(res.body.entry.name).toBe('Chicken & Rice');
    expect(res.body.entry.unit).toBe('portion');
    expect(res.body.entry.quantity).toBe(1);
    expect(res.body.entry.kcal).toBeCloseTo(575);
    expect(res.body.entry.protein).toBeCloseTo((310 + 13.5) / 4);

    // It shows up in the day's diary and totals.
    const day = await request(app)
      .get('/diary')
      .query({ date: '2026-07-16' })
      .set('Authorization', `Bearer ${token}`);
    expect(day.body.entries).toHaveLength(1);
    expect(day.body.entries[0].meal).toBe('lunch');

    const summary = await request(app)
      .get('/diary/summary')
      .query({ date: '2026-07-16' })
      .set('Authorization', `Bearer ${token}`);
    expect(summary.body.summary.consumed.kcal).toBeCloseTo(575);
  });

  it('defaults date/meal and rejects bad values', async () => {
    const token = await registerAndGetToken();
    const created = await createBatch(token);
    const id = created.body.batch.id;

    const defaulted = await request(app)
      .post(`/batches/${id}/eat`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(defaulted.status).toBe(200);
    expect(defaulted.body.entry.meal).toBe('snacks');
    expect(defaulted.body.entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const badMeal = await request(app)
      .post(`/batches/${id}/eat`)
      .set('Authorization', `Bearer ${token}`)
      .send({ meal: 'brunch' });
    expect(badMeal.status).toBe(400);
  });

  it('decrements to zero, then 409s without logging another entry', async () => {
    const token = await registerAndGetToken();
    const created = await createBatch(token, { portions: 2 });
    const id = created.body.batch.id;

    const eat = () =>
      request(app)
        .post(`/batches/${id}/eat`)
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-07-16', meal: 'dinner' });

    expect((await eat()).body.batch.portionsRemaining).toBe(1);
    expect((await eat()).body.batch.portionsRemaining).toBe(0);
    expect((await eat()).status).toBe(409);

    const day = await request(app)
      .get('/diary')
      .query({ date: '2026-07-16' })
      .set('Authorization', `Bearer ${token}`);
    expect(day.body.entries).toHaveLength(2);
  });

  it("404s for another user's batch", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    const created = await createBatch(token);

    const res = await request(app)
      .post(`/batches/${created.body.batch.id}/eat`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });

  it('logs multiple portions at once and scales the snapshot', async () => {
    const token = await registerAndGetToken();
    const created = await createBatch(token, { portions: 4 });

    const res = await request(app)
      .post(`/batches/${created.body.batch.id}/eat`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-16', meal: 'dinner', portions: 2 });

    expect(res.status).toBe(200);
    expect(res.body.batch.portionsRemaining).toBe(2);
    expect(res.body.entry.quantity).toBe(2);
    // 2300 kcal batch ÷ 4 portions × 2 portions eaten = 1150 kcal.
    expect(res.body.entry.kcal).toBeCloseTo(1150);
  });

  it('rejects a portions count that is not a positive integer, or exceeds stock', async () => {
    const token = await registerAndGetToken();
    const created = await createBatch(token, { portions: 2 });
    const id = created.body.batch.id;

    for (const bad of [0, -1, 1.5, 'two']) {
      const res = await request(app)
        .post(`/batches/${id}/eat`)
        .set('Authorization', `Bearer ${token}`)
        .send({ portions: bad });
      expect(res.status).toBe(400);
    }

    const tooMany = await request(app)
      .post(`/batches/${id}/eat`)
      .set('Authorization', `Bearer ${token}`)
      .send({ portions: 3 });
    expect(tooMany.status).toBe(409);
  });
});
