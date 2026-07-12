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

describe('POST /auth/register', () => {
  it('creates a user and returns a token', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'New@Example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('new@example.com'); // normalised to lowercase
    expect(res.body.user.onboardingComplete).toBe(false);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/auth/register').send({ email: 'dup@example.com', password: 'password123' });
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' });

    expect(res.status).toBe(409);
  });

  it('resolves a concurrent duplicate signup to 201 + 409, never 500', async () => {
    const signup = () =>
      request(app).post('/auth/register').send({ email: 'race@example.com', password: 'password123' });

    const statuses = (await Promise.all([signup(), signup()])).map((r) => r.status).sort();

    expect(statuses).toEqual([201, 409]);
  });

  it('rejects an invalid email with 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
  });

  it('rejects a too-short password with 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'short@example.com', password: 'short' });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  const credentials = { email: 'member@example.com', password: 'password123' };

  beforeEach(async () => {
    await request(app).post('/auth/register').send(credentials);
  });

  it('returns a token for valid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'Member@Example.com', password: 'password123' }); // case-insensitive email

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('member@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: credentials.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('rejects an unknown email with 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('rejects a missing password with 400', async () => {
    const res = await request(app).post('/auth/login').send({ email: credentials.email });

    expect(res.status).toBe(400);
  });
});
