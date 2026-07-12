import { Router } from 'express';

import { signToken } from '../auth/jwt.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { prisma } from '../prisma.js';
import { serializeUser } from '../serializers.js';

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// A real 12-round bcrypt hash we compare against when the email is unknown, so
// login spends the same time whether or not an account exists. Without this the
// no-user path skips bcrypt and returns markedly faster, leaking which emails
// are registered via response timing.
const DUMMY_PASSWORD_HASH = '$2b$12$7WmV0QqSqTIekdLuaFUEpePfeGlj6dwPaj3D1VNxl3BnWYpHdH1w2';

// POST /auth/register — create an account, return an auth token + the user.
authRouter.post('/register', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const user = await prisma.user.create({
    data: { email: normalizedEmail, passwordHash: await hashPassword(password) },
  });

  res.status(201).json({ token: signToken(user.id), user: serializeUser(user) });
});

// POST /auth/login — verify credentials, return an auth token + the user.
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  // Always run one bcrypt comparison — against a dummy hash when the email is
  // unknown — so the response takes the same time and status (401) whether the
  // email is unregistered or the password is wrong. This avoids leaking which
  // emails have accounts via either the body or the response timing.
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordOk) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  res.json({ token: signToken(user.id), user: serializeUser(user) });
});
