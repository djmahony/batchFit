import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../prisma.js';

beforeEach(async () => {
  await prisma.recipe.deleteMany();
  await prisma.food.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function registerAndGetToken(email = 'chef@example.com') {
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

describe('POST /recipes', () => {
  it('creates a recipe with per-portion macros from default amounts', async () => {
    const token = await registerAndGetToken();
    const { chicken, rice } = await seedFoods();

    const res = await request(app)
      .post('/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Chicken & Rice',
        defaultPortions: 4,
        ingredients: [
          { foodId: chicken.id, grams: 1000 },
          { foodId: rice.id, grams: 500 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.recipe.defaultPortions).toBe(4);
    expect(res.body.recipe.totalMacros.kcal).toBeCloseTo(2300);
    expect(res.body.recipe.perPortionMacros.kcal).toBeCloseTo(575);
  });

  it('rejects invalid bodies with 400', async () => {
    const token = await registerAndGetToken();
    const { chicken } = await seedFoods();
    const valid = {
      name: 'R',
      defaultPortions: 2,
      ingredients: [{ foodId: chicken.id, grams: 100 }],
    };

    for (const bad of [
      { ...valid, name: ' ' },
      { ...valid, defaultPortions: 0 },
      { ...valid, ingredients: [] },
      { ...valid, ingredients: [{ foodId: chicken.id, grams: -5 }] },
    ]) {
      const res = await request(app)
        .post('/recipes')
        .set('Authorization', `Bearer ${token}`)
        .send(bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
  });

  it('rejects a request with no token with 401', async () => {
    const res = await request(app).post('/recipes').send({});
    expect(res.status).toBe(401);
  });
});

describe('GET /recipes', () => {
  it("lists only the caller's recipes", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    const { chicken } = await seedFoods();
    const body = {
      name: 'Mine',
      defaultPortions: 2,
      ingredients: [{ foodId: chicken.id, grams: 100 }],
    };

    await request(app).post('/recipes').set('Authorization', `Bearer ${token}`).send(body);
    await request(app)
      .post('/recipes')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ ...body, name: 'Theirs' });

    const res = await request(app).get('/recipes').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.recipes).toHaveLength(1);
    expect(res.body.recipes[0].name).toBe('Mine');
  });
});

describe('PUT /recipes/:id', () => {
  it('replaces name, portions and ingredients; macros update', async () => {
    const token = await registerAndGetToken();
    const { chicken, rice } = await seedFoods();
    const created = await request(app)
      .post('/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Chicken & Rice',
        defaultPortions: 4,
        ingredients: [{ foodId: chicken.id, grams: 1000 }],
      });

    const res = await request(app)
      .put(`/recipes/${created.body.recipe.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Chicken & extra rice',
        defaultPortions: 5,
        ingredients: [
          { foodId: chicken.id, grams: 1000 },
          { foodId: rice.id, grams: 1000 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.recipe.name).toBe('Chicken & extra rice');
    expect(res.body.recipe.ingredients).toHaveLength(2);
    expect(res.body.recipe.perPortionMacros.kcal).toBeCloseTo((1650 + 1300) / 5);
  });

  it("404s for another user's recipe", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    const { chicken } = await seedFoods();
    const created = await request(app)
      .post('/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Mine',
        defaultPortions: 2,
        ingredients: [{ foodId: chicken.id, grams: 100 }],
      });

    const res = await request(app)
      .put(`/recipes/${created.body.recipe.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        name: 'Hijacked',
        defaultPortions: 2,
        ingredients: [{ foodId: chicken.id, grams: 100 }],
      });

    expect(res.status).toBe(404);
  });
});
