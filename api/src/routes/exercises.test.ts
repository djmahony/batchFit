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

async function register(email = 'lifter@example.com') {
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  return { token: res.body.token as string, userId: res.body.user.id as string };
}

/** A finished workout containing one block of sets for `exerciseId`. */
async function finishedWorkout(
  userId: string,
  exerciseId: string,
  name: string,
  sets: { weightKg?: number; reps?: number; seconds?: number; distanceM?: number }[],
  date: string,
  finished = true,
) {
  return prisma.workout.create({
    data: {
      userId,
      date,
      finishedAt: finished ? new Date() : null,
      exercises: {
        create: {
          exerciseId,
          name,
          trackingMode: 'weight_reps',
          order: 0,
          sets: {
            create: sets.map((set, order) => ({
              order,
              weightKg: set.weightKg ?? null,
              reps: set.reps ?? null,
              seconds: set.seconds ?? null,
              distanceM: set.distanceM ?? null,
            })),
          },
        },
      },
    },
  });
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

describe('cardioMachine', () => {
  it('accepts every machine value on a cardio exercise', async () => {
    const token = await registerAndGetToken();
    for (const machine of [
      'treadmill',
      'bike',
      'rower',
      'elliptical',
      'stair_climber',
      'outdoor',
      'other',
    ]) {
      const res = await request(app)
        .post('/exercises')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Cardio on ${machine}`,
          muscleGroup: 'cardio',
          equipment: 'machine',
          trackingMode: 'time',
          cardioMachine: machine,
        });
      expect(res.status, machine).toBe(201);
      expect(res.body.exercise.cardioMachine).toBe(machine);
    }
  });

  it('rejects an invalid machine and a machine on a non-cardio exercise', async () => {
    const token = await registerAndGetToken();
    const invalid = await request(app)
      .post('/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Hoverboard sprints',
        muscleGroup: 'cardio',
        equipment: 'machine',
        trackingMode: 'time',
        cardioMachine: 'hoverboard',
      });
    expect(invalid.status).toBe(400);

    const nonCardio = await request(app)
      .post('/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...squat, cardioMachine: 'treadmill' });
    expect(nonCardio.status).toBe(400);
  });

  it('PATCH auto-clears the machine when the muscle group leaves cardio', async () => {
    const token = await registerAndGetToken();
    const created = await request(app)
      .post('/exercises')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bike intervals',
        muscleGroup: 'cardio',
        equipment: 'machine',
        trackingMode: 'time',
        cardioMachine: 'bike',
      });

    const patched = await request(app)
      .patch(`/exercises/${created.body.exercise.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ muscleGroup: 'legs', trackingMode: 'weight_reps' });
    expect(patched.status).toBe(200);
    expect(patched.body.exercise.muscleGroup).toBe('legs');
    expect(patched.body.exercise.cardioMachine).toBeNull();
  });
});

describe('GET /exercises picker filters', () => {
  it('filters by muscleGroup, by cardio machine, and combined with a name query', async () => {
    const token = await registerAndGetToken();
    await prisma.exercise.createMany({
      data: [
        { name: 'Back squat', muscleGroup: 'legs', equipment: 'barbell', trackingMode: 'weight_reps' },
        { name: 'Bench press', muscleGroup: 'chest', equipment: 'barbell', trackingMode: 'weight_reps' },
        { name: 'Cycling', muscleGroup: 'cardio', equipment: 'machine', trackingMode: 'time', cardioMachine: 'bike' },
        { name: 'Assault bike', muscleGroup: 'cardio', equipment: 'machine', trackingMode: 'time', cardioMachine: 'bike' },
        { name: 'Mystery cardio', muscleGroup: 'cardio', equipment: 'other', trackingMode: 'time' },
      ],
    });

    const legs = await request(app)
      .get('/exercises')
      .query({ muscleGroup: 'legs' })
      .set('Authorization', `Bearer ${token}`);
    expect(legs.body.exercises.map((e: { name: string }) => e.name)).toEqual(['Back squat']);

    const bikes = await request(app)
      .get('/exercises')
      .query({ muscleGroup: 'cardio', cardioMachine: 'bike' })
      .set('Authorization', `Bearer ${token}`);
    expect(bikes.body.exercises.map((e: { name: string }) => e.name)).toEqual([
      'Assault bike',
      'Cycling',
    ]);

    // "other" is the catch-all bucket: tagged-other plus untagged cardio rows.
    const other = await request(app)
      .get('/exercises')
      .query({ muscleGroup: 'cardio', cardioMachine: 'other' })
      .set('Authorization', `Bearer ${token}`);
    expect(other.body.exercises.map((e: { name: string }) => e.name)).toEqual(['Mystery cardio']);

    const combined = await request(app)
      .get('/exercises')
      .query({ muscleGroup: 'cardio', cardioMachine: 'bike', query: 'assault' })
      .set('Authorization', `Bearer ${token}`);
    expect(combined.body.exercises.map((e: { name: string }) => e.name)).toEqual(['Assault bike']);

    const invalid = await request(app)
      .get('/exercises')
      .query({ muscleGroup: 'wings' })
      .set('Authorization', `Bearer ${token}`);
    expect(invalid.status).toBe(400);
  });
});

describe('GET /exercises/recent', () => {
  it('returns most recently used first, de-duplicated, own workouts only', async () => {
    const { token, userId } = await register();
    const { userId: otherId } = await register('other@example.com');
    const squatEx = await prisma.exercise.create({ data: { ...squat, ownerId: null } });
    const bench = await prisma.exercise.create({
      data: { ...squat, name: 'Bench press', muscleGroup: 'chest' },
    });
    const curl = await prisma.exercise.create({
      data: { ...squat, name: 'Barbell curl', muscleGroup: 'arms' },
    });

    await finishedWorkout(userId, squatEx.id, squatEx.name, [{ weightKg: 100, reps: 5 }], '2026-07-01');
    await finishedWorkout(userId, bench.id, bench.name, [{ weightKg: 60, reps: 8 }], '2026-07-10');
    // Squat again, more recently — must appear once, first.
    await finishedWorkout(userId, squatEx.id, squatEx.name, [{ weightKg: 105, reps: 5 }], '2026-07-15');
    // Someone else's workout must not leak in.
    await finishedWorkout(otherId, curl.id, curl.name, [{ weightKg: 30, reps: 10 }], '2026-07-16');

    const res = await request(app).get('/exercises/recent').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.exercises.map((e: { name: string }) => e.name)).toEqual([
      'Back squat',
      'Bench press',
    ]);
  });
});

describe('GET /exercises/:id/history', () => {
  it('returns nulls with no history, and last + best once sessions exist', async () => {
    const { token, userId } = await register();
    const squatEx = await prisma.exercise.create({ data: { ...squat, ownerId: null } });

    const empty = await request(app)
      .get(`/exercises/${squatEx.id}/history`)
      .set('Authorization', `Bearer ${token}`);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({
      last: null,
      best: null,
      testedMax: null,
      videoId: null,
      videoQuery: null,
    });

    // Bigger lift in the OLDER session — best must find it, last must not.
    await finishedWorkout(userId, squatEx.id, squatEx.name, [{ weightKg: 120, reps: 5 }], '2026-06-01');
    await finishedWorkout(
      userId,
      squatEx.id,
      squatEx.name,
      [{ weightKg: 100, reps: 5 }, { weightKg: 100, reps: 3 }],
      '2026-07-01',
    );
    // An unfinished session with a huge lift must be ignored entirely.
    await finishedWorkout(userId, squatEx.id, squatEx.name, [{ weightKg: 200, reps: 5 }], '2026-07-10', false);

    const res = await request(app)
      .get(`/exercises/${squatEx.id}/history`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.last.date).toBe('2026-07-01');
    expect(res.body.last.sets).toHaveLength(2);
    expect(res.body.best.weightKg).toBe(120);
    expect(res.body.best.estimatedOneRepMax).toBe(140);
    expect(res.body.best.date).toBe('2026-06-01');
  });

  it("404s on another user's custom exercise", async () => {
    const { token } = await register();
    const { userId: otherId } = await register('other@example.com');
    const theirs = await prisma.exercise.create({ data: { ...squat, ownerId: otherId } });

    const res = await request(app)
      .get(`/exercises/${theirs.id}/history`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('one-rep max entries', () => {
  it('records a tested max, surfaces the heaviest in history, and deletes own entries', async () => {
    const { token } = await register();
    const { token: otherToken } = await register('other@example.com');
    const squatEx = await prisma.exercise.create({ data: { ...squat, ownerId: null } });

    const first = await request(app)
      .post(`/exercises/${squatEx.id}/one-rep-max`)
      .set('Authorization', `Bearer ${token}`)
      .send({ weightKg: 140, date: '2026-05-01' });
    expect(first.status).toBe(201);
    await request(app)
      .post(`/exercises/${squatEx.id}/one-rep-max`)
      .set('Authorization', `Bearer ${token}`)
      .send({ weightKg: 130, date: '2026-06-01' });

    const history = await request(app)
      .get(`/exercises/${squatEx.id}/history`)
      .set('Authorization', `Bearer ${token}`);
    // Heaviest wins, not most recent.
    expect(history.body.testedMax).toEqual({ weightKg: 140, date: '2026-05-01' });

    const otherDelete = await request(app)
      .delete(`/exercises/one-rep-max/${first.body.entry.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(otherDelete.status).toBe(404);

    const deleted = await request(app)
      .delete(`/exercises/one-rep-max/${first.body.entry.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(204);
  });

  it('rejects a tested max on a non-weight exercise and invalid weights', async () => {
    const { token } = await register();
    const plank = await prisma.exercise.create({
      data: { name: 'Plank', muscleGroup: 'core', equipment: 'bodyweight', trackingMode: 'time' },
    });
    const squatEx = await prisma.exercise.create({ data: { ...squat, ownerId: null } });

    const wrongMode = await request(app)
      .post(`/exercises/${plank.id}/one-rep-max`)
      .set('Authorization', `Bearer ${token}`)
      .send({ weightKg: 100 });
    expect(wrongMode.status).toBe(400);

    for (const weightKg of [0, -5, 'heavy']) {
      const res = await request(app)
        .post(`/exercises/${squatEx.id}/one-rep-max`)
        .set('Authorization', `Bearer ${token}`)
        .send({ weightKg });
      expect(res.status, String(weightKg)).toBe(400);
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
