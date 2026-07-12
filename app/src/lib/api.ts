import { Platform } from 'react-native';

/**
 * Base URL of the BatchFit API.
 *
 * Override per-environment with `EXPO_PUBLIC_API_URL` — you'll need this on a
 * physical device, which can't reach the dev machine's `localhost` (point it at
 * your machine's LAN IP, e.g. `http://192.168.1.20:4000`). The fallbacks below
 * only cover the simulators: the Android emulator reaches the host via
 * `10.0.2.2`, while the iOS simulator shares `localhost`.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');

/** The current user as returned by the API (the password hash is never sent). */
export type User = {
  id: string;
  email: string;
  onboardingComplete: boolean;
  // Profile + targets are null until onboarding completes.
  sex: string | null;
  birthDate: string | null;
  heightCm: number | null;
  activityLevel: string | null;
  goal: string | null;
  goalRateKgPerWk: number | null;
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  units: string;
  targetKcal: number | null;
  targetProtein: number | null;
  targetFat: number | null;
  targetCarbs: number | null;
  targetFibre: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = { token: string; user: User };

/** Thrown for any non-2xx response (or an unreachable server, with `status: 0`). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  /** Bearer token for protected routes. */
  token?: string;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data.error === 'string'
        ? data.error
        : 'Something went wrong. Please try again.';
    throw new ApiError(res.status, message);
  }
  return data as T;
}

/** Typed calls against the BatchFit auth API (F1). */
export const api = {
  register: (email: string, password: string) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: { email, password } }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),
  me: (token: string) => request<{ user: User }>('/me', { token }),
};
