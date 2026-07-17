import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../prisma.js';
import { resetDb } from '../test/resetDb.js';

beforeEach(resetDb);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /me', () => {
  const credentials = { email: 'member@example.com', password: 'password123' };

  async function registerAndGetToken() {
    const res = await request(app).post('/auth/register').send(credentials);
    return res.body.token as string;
  }

  it('returns the current user for a valid token', async () => {
    const token = await registerAndGetToken();

    const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('member@example.com');
    expect(res.body.user.onboardingComplete).toBe(false);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a request with no token with 401', async () => {
    const res = await request(app).get('/me');

    expect(res.status).toBe(401);
  });

  it('rejects a request with an invalid token with 401', async () => {
    const res = await request(app).get('/me').set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
  });
});

describe('PUT /me/profile', () => {
  const credentials = { email: 'onboarder@example.com', password: 'password123' };

  const validProfile = {
    sex: 'male',
    birthDate: '1990-06-15',
    heightCm: 180,
    activityLevel: 'moderate',
    goal: 'lose',
    goalRateKgPerWk: 0.5,
    currentWeightKg: 90,
    goalWeightKg: 80,
    units: 'metric',
    targetKcal: 2200,
    targetProtein: 180,
    targetFat: 61,
    targetCarbs: 232,
    targetFibre: 31,
  };

  async function registerAndGetToken() {
    const res = await request(app).post('/auth/register').send(credentials);
    return res.body.token as string;
  }

  it('saves the profile + targets and marks onboarding complete', async () => {
    const token = await registerAndGetToken();

    const res = await request(app)
      .put('/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send(validProfile);

    expect(res.status).toBe(200);
    expect(res.body.user.onboardingComplete).toBe(true);
    expect(res.body.user.goal).toBe('lose');
    expect(res.body.user.targetKcal).toBe(2200);
    expect(res.body.user.passwordHash).toBeUndefined();

    // The saved values come back on a plain GET /me too.
    const me = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.user.onboardingComplete).toBe(true);
    expect(me.body.user.currentWeightKg).toBe(90);
    expect(me.body.user.birthDate).toContain('1990-06-15');
  });

  it('nulls the weekly rate for a maintain goal', async () => {
    const token = await registerAndGetToken();

    const res = await request(app)
      .put('/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProfile, goal: 'maintain', goalRateKgPerWk: 0.5 });

    expect(res.status).toBe(200);
    expect(res.body.user.goal).toBe('maintain');
    expect(res.body.user.goalRateKgPerWk).toBeNull();
  });

  it('requires a weekly rate for lose/build goals', async () => {
    const token = await registerAndGetToken();

    const res = await request(app)
      .put('/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProfile, goal: 'build', goalRateKgPerWk: undefined });

    expect(res.status).toBe(400);
  });

  it('rejects an invalid enum value with 400', async () => {
    const token = await registerAndGetToken();

    const res = await request(app)
      .put('/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProfile, activityLevel: 'olympic' });

    expect(res.status).toBe(400);
  });

  it('rejects a missing target with 400', async () => {
    const token = await registerAndGetToken();

    const res = await request(app)
      .put('/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validProfile, targetFibre: undefined });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('targetFibre');
  });

  it('rejects a request with no token with 401', async () => {
    const res = await request(app).put('/me/profile').send(validProfile);

    expect(res.status).toBe(401);
  });
});

describe('PATCH /me/profile', () => {
  const credentials = { email: 'tweaker@example.com', password: 'password123' };

  const validProfile = {
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

  async function onboardedToken() {
    const res = await request(app).post('/auth/register').send(credentials);
    const token = res.body.token as string;
    await request(app).put('/me/profile').set('Authorization', `Bearer ${token}`).send(validProfile);
    return token;
  }

  it('updates just the provided fields and leaves the rest alone', async () => {
    const token = await onboardedToken();

    const res = await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetKcal: 2000, units: 'imperial' });

    expect(res.status).toBe(200);
    expect(res.body.user.targetKcal).toBe(2000);
    expect(res.body.user.units).toBe('imperial');
    expect(res.body.user.targetProtein).toBe(180);
    expect(res.body.user.onboardingComplete).toBe(true);
  });

  it('nulls the weekly rate when switching to maintain', async () => {
    const token = await onboardedToken();

    const res = await request(app)
      .patch('/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ goal: 'maintain' });

    expect(res.status).toBe(200);
    expect(res.body.user.goal).toBe('maintain');
    expect(res.body.user.goalRateKgPerWk).toBeNull();
  });

  it('validates provided fields and rejects empty patches', async () => {
    const token = await onboardedToken();

    for (const bad of [{ targetKcal: -5 }, { goal: 'bulk' }, {}]) {
      const res = await request(app)
        .patch('/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
  });
});
