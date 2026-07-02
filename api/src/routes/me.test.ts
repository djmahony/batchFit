import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../app.js';
import { prisma } from '../prisma.js';

beforeEach(async () => {
  await prisma.user.deleteMany();
});

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
