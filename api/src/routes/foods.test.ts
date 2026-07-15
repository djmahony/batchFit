import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../prisma.js';

beforeEach(async () => {
  await prisma.logEntry.deleteMany();
  await prisma.food.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function registerAndGetToken(email: string) {
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  return res.body.token as string;
}

const oats = { name: 'Oats', kcal: 379, protein: 13.5, fat: 6.9, carbs: 67.7, fibre: 10.1 };

describe('GET /foods', () => {
  it('rejects a request with no token with 401', async () => {
    const res = await request(app).get('/foods');
    expect(res.status).toBe(401);
  });

  it('returns reference foods plus only the caller’s custom foods', async () => {
    const token = await registerAndGetToken('a@example.com');
    const otherToken = await registerAndGetToken('b@example.com');

    // A shared reference food (no owner) seeded directly.
    await prisma.food.create({ data: { ...oats, ownerId: null } });
    // One custom food each.
    await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...oats, name: 'My protein granola' });
    await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ ...oats, name: 'Someone else’s food' });

    const res = await request(app).get('/foods').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.foods.map((f: { name: string }) => f.name);
    expect(names).toContain('Oats');
    expect(names).toContain('My protein granola');
    expect(names).not.toContain('Someone else’s food');
  });
});

describe('GET /foods?query=', () => {
  it('searches name and brand across reference + own foods, case-insensitively', async () => {
    const token = await registerAndGetToken('searcher@example.com');
    const otherToken = await registerAndGetToken('other@example.com');

    await prisma.food.createMany({
      data: [
        { ...oats, name: 'Chicken breast' },
        { ...oats, name: 'Chicken thigh (skinless)' },
        { ...oats, name: 'Cooked white rice' },
      ],
    });
    await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...oats, name: 'Leftover roast chicken' });
    await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ ...oats, name: 'Chicken curry (not mine)' });
    await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...oats, name: 'Granola', brand: 'ChickenBrand Co' });

    const res = await request(app)
      .get('/foods')
      .query({ query: 'chicken' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.foods.map((f: { name: string }) => f.name).sort();
    expect(names).toEqual([
      'Chicken breast',
      'Chicken thigh (skinless)',
      'Granola',
      'Leftover roast chicken',
    ]);
  });

  it('returns everything visible for a blank query', async () => {
    const token = await registerAndGetToken('searcher@example.com');
    await prisma.food.create({ data: { ...oats } });

    const res = await request(app)
      .get('/foods')
      .query({ query: '  ' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.foods).toHaveLength(1);
  });

  it('returns an empty list when nothing matches', async () => {
    const token = await registerAndGetToken('searcher@example.com');
    await prisma.food.create({ data: { ...oats } });

    const res = await request(app)
      .get('/foods')
      .query({ query: 'xyzzy' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.foods).toEqual([]);
  });
});

describe('GET /foods/recent', () => {
  it('returns recently logged foods, newest first, one row per food', async () => {
    const token = await registerAndGetToken('recent@example.com');
    const chicken = await prisma.food.create({ data: { ...oats, name: 'Chicken breast' } });
    const rice = await prisma.food.create({ data: { ...oats, name: 'Cooked white rice' } });

    const log = (foodId: string, date: string) =>
      request(app)
        .post('/diary')
        .set('Authorization', `Bearer ${token}`)
        .send({ date, meal: 'lunch', foodId, quantity: 100 });

    await log(chicken.id, '2026-07-13');
    await log(rice.id, '2026-07-14');
    await log(chicken.id, '2026-07-15'); // chicken again — should dedupe & lead

    const res = await request(app).get('/foods/recent').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.foods.map((f: { name: string }) => f.name)).toEqual([
      'Chicken breast',
      'Cooked white rice',
    ]);
  });

  it('is empty for a user with no logs', async () => {
    const token = await registerAndGetToken('fresh@example.com');
    const res = await request(app).get('/foods/recent').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.foods).toEqual([]);
  });

  it('rejects a request with no token with 401', async () => {
    const res = await request(app).get('/foods/recent');
    expect(res.status).toBe(401);
  });
});

describe('POST /foods', () => {
  it('creates a custom food owned by the caller', async () => {
    const token = await registerAndGetToken('owner@example.com');

    const res = await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...oats, brand: 'Flahavan’s' });

    expect(res.status).toBe(201);
    expect(res.body.food.name).toBe('Oats');
    expect(res.body.food.brand).toBe('Flahavan’s');
    expect(res.body.food.kcal).toBe(379);
    expect(res.body.food.ownerId).toBeTruthy();
  });

  it('rejects a missing name with 400', async () => {
    const token = await registerAndGetToken('owner@example.com');

    const res = await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...oats, name: '  ' });

    expect(res.status).toBe(400);
  });

  it('rejects missing or negative macros with 400', async () => {
    const token = await registerAndGetToken('owner@example.com');

    const missing = await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...oats, fibre: undefined });
    expect(missing.status).toBe(400);
    expect(missing.body.error).toContain('fibre');

    const negative = await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...oats, fat: -1 });
    expect(negative.status).toBe(400);
  });

  it('rejects a request with no token with 401', async () => {
    const res = await request(app).post('/foods').send(oats);
    expect(res.status).toBe(401);
  });
});
