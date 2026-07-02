import jwt from 'jsonwebtoken';

// Tokens carry only the user id; everything else is looked up from the DB.
const TOKEN_TTL = '7d';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  // Dev fallback so the API runs without extra setup. Production MUST set JWT_SECRET.
  return 'dev-insecure-secret-change-me';
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, getSecret(), { expiresIn: TOKEN_TTL });
}

/** Returns the user id from a valid token, or null if it's invalid/expired. */
export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, getSecret());
    if (typeof payload === 'object' && payload !== null && typeof payload.sub === 'string') {
      return payload.sub;
    }
    return null;
  } catch {
    return null;
  }
}
