import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../prisma.js';
import { resetDb } from '../test/resetDb.js';

beforeEach(resetDb);

afterAll(async () => {
  await prisma.$disconnect();
});

async function registerAndGetToken(email = 'lifter@example.com') {
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  return res.body.token as string;
}

const squat = {
  name: 'Back squat',
  muscleGroup: 'legs',
  equipment: 'barbell',
  trackingMode: 'weight_reps',
};

describe('GET /exercises', () => {
  it("returns library exercises plus only the caller's custom ones; ?query= filters", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    await prisma.exercise.create({ data: { ...squat, ownerId: null } });
    await request(app)
      .post('/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...squat, name: 'My squat variation' });
    await request(app)
      .post('/exercises')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ ...squat, name: 'Someone else’s squat' });

    const all = await request(app).get('/exercises').set('Authorization', `Bearer ${token}`);
    const names = all.body.exercises.map((e: { name: string }) => e.name);
    expect(names).toContain('Back squat');
    expect(names).toContain('My squat variation');
    expect(names).not.toContain('Someone else’s squat');

    const filtered = await request(app)
      .get('/exercises')
      .query({ query: 'variation' })
      .set('Authorization', `Bearer ${token}`);
    expect(filtered.body.exercises.map((e: { name: string }) => e.name)).toEqual([
      'My squat variation',
    ]);
  });

  it('rejects a request with no token with 401', async () => {
    const res = await request(app).get('/exercises');
    expect(res.status).toBe(401);
  });
});

describe('POST /exercises', () => {
  it('creates a custom exercise and validates enums', async () => {
    const token = await registerAndGetToken();

    const created = await request(app)
      .post('/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send(squat);
    expect(created.status).toBe(201);
    expect(created.body.exercise.ownerId).toBeTruthy();

    for (const bad of [
      { ...squat, name: ' ' },
      { ...squat, muscleGroup: 'wings' },
      { ...squat, equipment: 'anvil' },
      { ...squat, trackingMode: 'vibes' },
    ]) {
      const res = await request(app)
        .post('/exercises')
        .set('Authorization', `Bearer ${token}`)
        .send(bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
  });
});

describe('PATCH & DELETE /exercises/:id', () => {
  it('edits and deletes own exercises only — the library is read-only', async () => {
    const token = await registerAndGetToken();
    const library = await prisma.exercise.create({ data: { ...squat, ownerId: null } });
    const created = await request(app)
      .post('/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...squat, name: 'Pause squat' });
    const ownId = created.body.exercise.id;

    const patched = await request(app)
      .patch(`/exercises/${ownId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Tempo squat' });
    expect(patched.status).toBe(200);
    expect(patched.body.exercise.name).toBe('Tempo squat');

    const patchLibrary = await request(app)
      .patch(`/exercises/${library.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Vandalised' });
    expect(patchLibrary.status).toBe(404);

    const deleted = await request(app)
      .delete(`/exercises/${ownId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(204);

    const deleteLibrary = await request(app)
      .delete(`/exercises/${library.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteLibrary.status).toBe(404);
  });
});
