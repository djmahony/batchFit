import { describe, expect, it } from 'vitest';

import { signToken, verifyToken } from './jwt.js';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash).not.toBe('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('wrong password', hash)).toBe(false);
  });
});

describe('jwt', () => {
  it('round-trips a user id', () => {
    const token = signToken('user_123');
    expect(verifyToken(token)).toBe('user_123');
  });

  it('returns null for a malformed token', () => {
    expect(verifyToken('not-a-real-token')).toBeNull();
  });
});
