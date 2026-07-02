import { Router } from 'express';

import { requireAuth } from '../auth/requireAuth.js';
import { prisma } from '../prisma.js';
import { serializeUser } from '../serializers.js';

export const meRouter = Router();

// GET /me — the current user (profile, targets, onboardingComplete).
meRouter.get('/', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user: serializeUser(user) });
});
