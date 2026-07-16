import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../prisma.js';
import { resetDb } from '../test/resetDb.js';

beforeEach(resetDb);

afterAll(async () => {
  await prisma.$disconnect();
});

async function registerAndGetToken(email = 'weigher@example.com') {
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  return res.body.token as string;
}

describe('POST /weights', () => {
  it('logs a reading and upserts a second weigh-in on the same day', async () => {
    const token = await registerAndGetToken();

    const first = await request(app)
      .post('/weights')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-16', weightKg: 90.4, note: 'post-holiday' });
    expect(first.status).toBe(201);
    expect(first.body.entry.weightKg).toBe(90.4);

    const second = await request(app)
      .post('/weights')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-16', weightKg: 90.1 });
    expect(second.body.entry.id).toBe(first.body.entry.id);
    expect(second.body.entry.weightKg).toBe(90.1);

    const list = await request(app).get('/weights').set('Authorization', `Bearer ${token}`);
    expect(list.body.entries).toHaveLength(1);
  });

  it('rejects bad dates and non-positive weights', async () => {
    const token = await registerAndGetToken();
    for (const bad of [
      { date: '16/07/2026', weightKg: 90 },
      { date: '2026-07-16', weightKg: 0 },
      { date: '2026-07-16', weightKg: 'ninety' },
    ]) {
      const res = await request(app)
        .post('/weights')
        .set('Authorization', `Bearer ${token}`)
        .send(bad);
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
  });

  it('rejects a request with no token with 401', async () => {
    const res = await request(app).post('/weights').send({});
    expect(res.status).toBe(401);
  });
});

describe('GET /weights', () => {
  it("returns only the caller's readings, oldest first", async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    const log = (t: string, date: string, weightKg: number) =>
      request(app).post('/weights').set('Authorization', `Bearer ${t}`).send({ date, weightKg });

    await log(token, '2026-07-16', 90);
    await log(token, '2026-07-10', 91);
    await log(otherToken, '2026-07-16', 70);

    const res = await request(app).get('/weights').set('Authorization', `Bearer ${token}`);
    expect(res.body.entries.map((e: { date: string }) => e.date)).toEqual([
      '2026-07-10',
      '2026-07-16',
    ]);
  });
});

describe('PATCH & DELETE /weights/:id', () => {
  it('edits value/note and deletes; scoped to the owner', async () => {
    const token = await registerAndGetToken();
    const otherToken = await registerAndGetToken('other@example.com');
    const created = await request(app)
      .post('/weights')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-16', weightKg: 90 });
    const id = created.body.entry.id;

    const patched = await request(app)
      .patch(`/weights/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ weightKg: 89.6, note: 'better' });
    expect(patched.status).toBe(200);
    expect(patched.body.entry.weightKg).toBe(89.6);
    expect(patched.body.entry.note).toBe('better');

    const foreign = await request(app)
      .patch(`/weights/${id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ weightKg: 1 });
    expect(foreign.status).toBe(404);

    const deleted = await request(app)
      .delete(`/weights/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(204);

    const list = await request(app).get('/weights').set('Authorization', `Bearer ${token}`);
    expect(list.body.entries).toHaveLength(0);
  });
});
