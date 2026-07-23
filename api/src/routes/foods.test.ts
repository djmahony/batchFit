import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../prisma.js';
import { resetDb } from '../test/resetDb.js';

beforeEach(resetDb);

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

describe('GET /foods/:id', () => {
  it('returns a reference food or an own food', async () => {
    const token = await registerAndGetToken('viewer@example.com');
    const reference = await prisma.food.create({ data: { ...oats } });

    const res = await request(app)
      .get(`/foods/${reference.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.food.name).toBe('Oats');
  });

  it("404s for another user's custom food", async () => {
    const token = await registerAndGetToken('viewer@example.com');
    const otherToken = await registerAndGetToken('other@example.com');
    const created = await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ ...oats, name: 'Not yours' });

    const res = await request(app)
      .get(`/foods/${created.body.food.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
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

  it('accepts an optional barcode, and rejects an empty one', async () => {
    const token = await registerAndGetToken('scanner@example.com');

    const withBarcode = await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...oats, name: 'Scanned oats', barcode: '5012345678900' });
    expect(withBarcode.status).toBe(201);
    expect(withBarcode.body.food.barcode).toBe('5012345678900');

    const empty = await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...oats, barcode: '   ' });
    expect(empty.status).toBe(400);
  });

  it("falls back to no barcode if another user's private entry already claimed it", async () => {
    const token = await registerAndGetToken('me@example.com');
    const otherToken = await registerAndGetToken('someone@example.com');

    await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ ...oats, name: "Someone else's entry", barcode: '111222333' });

    const res = await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...oats, name: 'My own entry', barcode: '111222333' });

    expect(res.status).toBe(201);
    expect(res.body.food.barcode).toBeNull();
  });
});

describe('GET /foods/barcode/:code', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a cached match without calling Open Food Facts', async () => {
    const token = await registerAndGetToken('cache@example.com');
    await prisma.food.create({ data: { ...oats, ownerId: null, barcode: '1111111111111' } });

    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const res = await request(app)
      .get('/foods/barcode/1111111111111')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.food.name).toBe('Oats');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('looks up Open Food Facts on a miss and caches the result as a shared food', async () => {
    const token = await registerAndGetToken('lookup@example.com');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          status: 1,
          product: {
            product_name: 'Chocolate Digestives',
            brands: 'McVities,Other Brand',
            nutriments: {
              'energy-kcal_100g': 500,
              proteins_100g: 6,
              fat_100g: 24,
              carbohydrates_100g: 65,
              // fiber_100g deliberately omitted — should default to 0.
            },
          },
        }),
      }),
    );

    const res = await request(app)
      .get('/foods/barcode/2222222222222')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.food).toMatchObject({
      name: 'Chocolate Digestives',
      brand: 'McVities',
      barcode: '2222222222222',
      ownerId: null,
      kcal: 500,
      protein: 6,
      fat: 24,
      carbs: 65,
      fibre: 0,
    });

    // A second scan (by anyone) must hit the cache, not Open Food Facts again.
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const again = await request(app)
      .get('/foods/barcode/2222222222222')
      .set('Authorization', `Bearer ${token}`);
    expect(again.status).toBe(200);
    expect(again.body.food.id).toBe(res.body.food.id);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('404s when Open Food Facts has no product, is missing macros, or errors', async () => {
    const token = await registerAndGetToken('notfound@example.com');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ status: 0 }) }));
    const notFound = await request(app)
      .get('/foods/barcode/3333333333333')
      .set('Authorization', `Bearer ${token}`);
    expect(notFound.status).toBe(404);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          status: 1,
          product: { product_name: 'Mystery bar', nutriments: { 'energy-kcal_100g': 400 } },
        }),
      }),
    );
    const incomplete = await request(app)
      .get('/foods/barcode/4444444444444')
      .set('Authorization', `Bearer ${token}`);
    expect(incomplete.status).toBe(404);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );
    const networkError = await request(app)
      .get('/foods/barcode/5555555555555')
      .set('Authorization', `Bearer ${token}`);
    expect(networkError.status).toBe(404);
  });

  it('rejects a blank barcode with 400', async () => {
    const token = await registerAndGetToken('blank@example.com');
    const res = await request(app)
      .get('/foods/barcode/%20%20')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("never leaks another user's private food when a fresh OFF lookup collides with it", async () => {
    const ownerToken = await registerAndGetToken('privateowner@example.com');
    const scannerToken = await registerAndGetToken('scanner2@example.com');

    // The owner already has a private (unshared) entry for this barcode —
    // e.g. their own "not found on OFF" manual fallback.
    await request(app)
      .post('/foods')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...oats, name: "Owner's private entry", barcode: '666777888' });

    // A different user scans the same barcode. It's invisible to them, so
    // this hits the "not found locally" path and queries Open Food Facts —
    // which succeeds, but creating the shared row collides with the
    // existing (private, globally-unique) barcode.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          status: 1,
          product: {
            product_name: 'Some Product',
            nutriments: {
              'energy-kcal_100g': 200,
              proteins_100g: 5,
              fat_100g: 5,
              carbohydrates_100g: 20,
            },
          },
        }),
      }),
    );

    const res = await request(app)
      .get('/foods/barcode/666777888')
      .set('Authorization', `Bearer ${scannerToken}`);

    // Must not leak the owner's private food — 404, not their data.
    expect(res.status).toBe(404);
  });

  it('rejects a request with no token with 401', async () => {
    const res = await request(app).get('/foods/barcode/123');
    expect(res.status).toBe(401);
  });
});
