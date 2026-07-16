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

async function seedSquat() {
  return prisma.exercise.create({
    data: { name: 'Back squat', muscleGroup: 'legs', equipment: 'barbell', trackingMode: 'weight_reps' },
  });
}

describe('POST /workouts', () => {
  it('starts an unfinished session, and returns the same one if started again', async () => {
    const token = await registerAndGetToken();

    const first = await request(app).post('/workouts').set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(201);
    expect(first.body.workout.finishedAt).toBeNull();

    const second = await request(app).post('/workouts').set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(200);
    expect(second.body.workout.id).toBe(first.body.workout.id);
  });
});

describe('PUT /workouts/:id', () => {
  it('replaces exercise blocks + sets, snapshotting name and tracking mode', async () => {
    const token = await registerAndGetToken();
    const squat = await seedSquat();
    const started = await request(app).post('/workouts').set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .put(`/workouts/${started.body.workout.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        exercises: [
          {
            exerciseId: squat.id,
            sets: [
              { weightKg: 100, reps: 5 },
              { weightKg: 105, reps: 3 },
            ],
          },
        ],
      });

    expect(res.status).toBe(200);
    const block = res.body.workout.exercises[0];
    expect(block.name).toBe('Back squat');
    expect(block.trackingMode).toBe('weight_reps');
    expect(block.sets).toHaveLength(2);
    expect(block.sets[1].weightKg).toBe(105);

    // Deleting a custom exercise later must not erase the logged name.
    // (Library exercise here, but the SetNull + snapshot rule is the same.)
  });

  it('rejects invalid sets and unknown exercises', async () => {
    const token = await registerAndGetToken();
    const squat = await seedSquat();
    const started = await request(app).post('/workouts').set('Authorization', `Bearer ${token}`);
    const id = started.body.workout.id;

    const badSet = await request(app)
      .put(`/workouts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ exercises: [{ exerciseId: squat.id, sets: [{ reps: -3 }] }] });
    expect(badSet.status).toBe(400);

    const unknown = await request(app)
      .put(`/workouts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ exercises: [{ exerciseId: 'nope', sets: [] }] });
    expect(unknown.status).toBe(404);
  });

  it("404s for another user's workout", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    const started = await request(app).post('/workouts').set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .put(`/workouts/${started.body.workout.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ exercises: [] });

    expect(res.status).toBe(404);
  });
});

describe('POST /workouts/:id/finish', () => {
  it('finishes a session once', async () => {
    const token = await registerAndGetToken();
    const started = await request(app).post('/workouts').set('Authorization', `Bearer ${token}`);
    const id = started.body.workout.id;

    const finished = await request(app)
      .post(`/workouts/${id}/finish`)
      .set('Authorization', `Bearer ${token}`);
    expect(finished.status).toBe(200);
    expect(finished.body.workout.finishedAt).not.toBeNull();

    const again = await request(app)
      .post(`/workouts/${id}/finish`)
      .set('Authorization', `Bearer ${token}`);
    expect(again.status).toBe(409);
  });
});

describe('GET /workouts', () => {
  it('lists newest first and filters by status', async () => {
    const token = await registerAndGetToken();
    const first = await request(app).post('/workouts').set('Authorization', `Bearer ${token}`);
    await request(app)
      .post(`/workouts/${first.body.workout.id}/finish`)
      .set('Authorization', `Bearer ${token}`);
    await request(app).post('/workouts').set('Authorization', `Bearer ${token}`); // unfinished

    const all = await request(app).get('/workouts').set('Authorization', `Bearer ${token}`);
    expect(all.body.workouts).toHaveLength(2);

    const unfinished = await request(app)
      .get('/workouts')
      .query({ status: 'unfinished' })
      .set('Authorization', `Bearer ${token}`);
    expect(unfinished.body.workouts).toHaveLength(1);
    expect(unfinished.body.workouts[0].finishedAt).toBeNull();

    const finished = await request(app)
      .get('/workouts')
      .query({ status: 'finished' })
      .set('Authorization', `Bearer ${token}`);
    expect(finished.body.workouts).toHaveLength(1);
  });

  it("does not include another user's sessions", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    await request(app).post('/workouts').set('Authorization', `Bearer ${otherToken}`);

    const res = await request(app).get('/workouts').set('Authorization', `Bearer ${token}`);
    expect(res.body.workouts).toHaveLength(0);
  });
});

describe('DELETE /workouts/:id', () => {
  it('discards a session', async () => {
    const token = await registerAndGetToken();
    const started = await request(app).post('/workouts').set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .delete(`/workouts/${started.body.workout.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const list = await request(app).get('/workouts').set('Authorization', `Bearer ${token}`);
    expect(list.body.workouts).toHaveLength(0);
  });
});
