import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { errorHandler } from './errorHandler.js';

describe('errorHandler', () => {
  it('turns a rejected async handler into a 500 JSON response', async () => {
    const app = express();
    app.get('/boom', async () => {
      throw new Error('db exploded');
    });
    app.use(errorHandler);

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/boom');
    consoleError.mockRestore();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Something went wrong' });
  });
});
