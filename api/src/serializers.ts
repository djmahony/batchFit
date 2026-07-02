import type { User } from '@prisma/client';

export type UserResponse = Omit<User, 'passwordHash'>;

/** Strips the password hash before a user is sent over the wire. */
export function serializeUser(user: User): UserResponse {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}
