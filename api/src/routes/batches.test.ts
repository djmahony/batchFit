import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../prisma.js';

beforeEach(async () => {
  await prisma.batch.deleteMany();
  await prisma.food.deleteMany();
  await prisma.user.deleteMany();
});

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

describe('POST /batches/:id/eat', () => {
  it('decrements portions remaining and 409s at zero', async () => {
    const token = await registerAndGetToken();
    const created = await createBatch(token, { portions: 2 });
    const id = created.body.batch.id;

    const eat = () =>
      request(app).post(`/batches/${id}/eat`).set('Authorization', `Bearer ${token}`);

    expect((await eat()).body.batch.portionsRemaining).toBe(1);
    expect((await eat()).body.batch.portionsRemaining).toBe(0);
    expect((await eat()).status).toBe(409);
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
});
