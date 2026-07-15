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

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'build';
export type Units = 'metric' | 'imperial';

/** Inputs for `POST /tools/tdee` (mirrors api/src/routes/tools.ts). */
export type TdeeInput = {
  sex: Sex;
  birthDate: string;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  /** Required for lose/build, ignored for maintain. */
  goalRateKgPerWk?: number;
};

export type TdeeResult = {
  bmr: number;
  maintenanceKcal: number;
  targets: { kcal: number; protein: number; fat: number; carbs: number; fibre: number };
};

/** Body for `PUT /me/profile` — what onboarding saves (all metric). */
export type ProfileInput = {
  sex: Sex;
  birthDate: string;
  heightCm: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  goalRateKgPerWk?: number;
  currentWeightKg: number;
  goalWeightKg?: number;
  units: Units;
  targetKcal: number;
  targetProtein: number;
  targetFat: number;
  targetCarbs: number;
  targetFibre: number;
};

/** The five tracked nutrients, everywhere. */
export type Macros = { kcal: number; protein: number; fat: number; carbs: number; fibre: number };

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

/** One diary line. Macros are snapshotted for the logged quantity at log time. */
export type LogEntry = Macros & {
  id: string;
  date: string;
  meal: Meal;
  name: string;
  foodId: string | null;
  quantity: number;
  unit: string;
  createdAt: string;
};

/** `GET /diary/summary` — consumed vs. targets; targets are null pre-onboarding. */
export type DiarySummary = {
  date: string;
  consumed: Macros;
  targets: { [K in keyof Macros]: number | null };
  remaining: { [K in keyof Macros]: number | null };
};

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

// Fail loudly instead of spinning forever when the server is unreachable (e.g.
// a physical device pointed at the wrong host). `fetch` has no built-in timeout.
const REQUEST_TIMEOUT_MS = 12000;

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    // Network failure or the timeout aborting the request.
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timeout);
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

/** Typed calls against the BatchFit API (auth + onboarding F1, diary F3). */
export const api = {
  register: (email: string, password: string) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: { email, password } }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),
  me: (token: string) => request<{ user: User }>('/me', { token }),
  tdee: (token: string, input: TdeeInput) =>
    request<TdeeResult>('/tools/tdee', { method: 'POST', body: input, token }),
  saveProfile: (token: string, profile: ProfileInput) =>
    request<{ user: User }>('/me/profile', { method: 'PUT', body: profile, token }),
  diary: (token: string, date: string) =>
    request<{ entries: LogEntry[] }>(`/diary?date=${date}`, { token }),
  diarySummary: (token: string, date: string) =>
    request<{ summary: DiarySummary }>(`/diary/summary?date=${date}`, { token }),
};
