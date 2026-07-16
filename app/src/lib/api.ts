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

/** A food with macros per 100g; `ownerId` null = shared reference food. */
export type Food = Macros & {
  id: string;
  name: string;
  brand: string | null;
  ownerId: string | null;
};

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

/** One ingredient of a cook/template, with its food attached. */
export type BatchIngredient = {
  id: string;
  foodId: string;
  grams: number;
  food: Food;
};

/** One actual cook, living in the inventory with a remaining count. */
export type Batch = {
  id: string;
  name: string;
  recipeId: string | null;
  portionsTotal: number;
  portionsRemaining: number;
  cookedAt: string;
  ingredients: BatchIngredient[];
  totalMacros: Macros;
  perPortionMacros: Macros;
};

/** A reusable template; cooking one produces a Batch. */
export type Recipe = {
  id: string;
  name: string;
  defaultPortions: number;
  ingredients: BatchIngredient[];
  totalMacros: Macros;
  perPortionMacros: Macros;
};

/** A movement from the Train library (ownerId null) or the user's own. */
export type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  trackingMode: 'weight_reps' | 'bodyweight_reps' | 'time' | 'distance';
  ownerId: string | null;
};

export type WorkoutSet = {
  id: string;
  order: number;
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  distanceM: number | null;
};

/** One exercise block in a session; name + trackingMode are snapshots. */
export type WorkoutExercise = {
  id: string;
  exerciseId: string | null;
  name: string;
  trackingMode: Exercise['trackingMode'];
  order: number;
  sets: WorkoutSet[];
};

/** A training session; `finishedAt` null = still in progress. */
export type Workout = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  exercises: WorkoutExercise[];
};

/** One bodyweight reading (kg canonical; one per day). */
export type WeightEntry = {
  id: string;
  date: string;
  weightKg: number;
  note: string | null;
};

/** `GET /progress` — raw readings + smoothed trend + range stats. */
export type ProgressData = {
  entries: WeightEntry[];
  trend: { date: string; trendKg: number }[];
  stats: { currentKg: number | null; changeKg: number | null; weeklyRateKg: number | null };
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
  searchFoods: (token: string, query = '') =>
    request<{ foods: Food[] }>(`/foods?query=${encodeURIComponent(query)}`, { token }),
  recentFoods: (token: string) => request<{ foods: Food[] }>('/foods/recent', { token }),
  food: (token: string, id: string) => request<{ food: Food }>(`/foods/${id}`, { token }),
  createFood: (token: string, input: Macros & { name: string; brand?: string }) =>
    request<{ food: Food }>('/foods', { method: 'POST', body: input, token }),
  addDiaryEntry: (token: string, input: { date: string; meal: Meal; foodId: string; quantity: number }) =>
    request<{ entry: LogEntry }>('/diary', { method: 'POST', body: input, token }),
  diaryEntry: (token: string, id: string) =>
    request<{ entry: LogEntry }>(`/diary/${id}`, { token }),
  updateDiaryEntry: (
    token: string,
    id: string,
    patch: { quantity?: number; meal?: Meal; date?: string },
  ) => request<{ entry: LogEntry }>(`/diary/${id}`, { method: 'PATCH', body: patch, token }),
  deleteDiaryEntry: (token: string, id: string) =>
    request<null>(`/diary/${id}`, { method: 'DELETE', token }),
  batches: (token: string, status?: 'active' | 'depleted') =>
    request<{ batches: Batch[] }>(`/batches${status ? `?status=${status}` : ''}`, { token }),
  batch: (token: string, id: string) => request<{ batch: Batch }>(`/batches/${id}`, { token }),
  createBatch: (
    token: string,
    input: {
      name: string;
      portions: number;
      recipeId?: string;
      ingredients: { foodId: string; grams: number }[];
    },
  ) => request<{ batch: Batch }>('/batches', { method: 'POST', body: input, token }),
  adjustBatch: (token: string, id: string, portionsRemaining: number) =>
    request<{ batch: Batch }>(`/batches/${id}`, {
      method: 'PATCH',
      body: { portionsRemaining },
      token,
    }),
  deleteBatch: (token: string, id: string) =>
    request<null>(`/batches/${id}`, { method: 'DELETE', token }),
  recipes: (token: string) => request<{ recipes: Recipe[] }>('/recipes', { token }),
  recipe: (token: string, id: string) => request<{ recipe: Recipe }>(`/recipes/${id}`, { token }),
  createRecipe: (
    token: string,
    input: { name: string; defaultPortions: number; ingredients: { foodId: string; grams: number }[] },
  ) => request<{ recipe: Recipe }>('/recipes', { method: 'POST', body: input, token }),
  progress: (token: string, days?: number) =>
    request<ProgressData>(`/progress${days ? `?days=${days}` : ''}`, { token }),
  logWeight: (token: string, input: { date: string; weightKg: number; note?: string | null }) =>
    request<{ entry: WeightEntry }>('/weights', { method: 'POST', body: input, token }),
  deleteWeight: (token: string, id: string) =>
    request<null>(`/weights/${id}`, { method: 'DELETE', token }),
  exercises: (token: string, query = '') =>
    request<{ exercises: Exercise[] }>(`/exercises?query=${encodeURIComponent(query)}`, { token }),
  createExercise: (
    token: string,
    input: Pick<Exercise, 'name' | 'muscleGroup' | 'equipment' | 'trackingMode'>,
  ) => request<{ exercise: Exercise }>('/exercises', { method: 'POST', body: input, token }),
  updateExercise: (
    token: string,
    id: string,
    input: Pick<Exercise, 'name' | 'muscleGroup' | 'equipment' | 'trackingMode'>,
  ) => request<{ exercise: Exercise }>(`/exercises/${id}`, { method: 'PATCH', body: input, token }),
  workouts: (token: string, status?: 'unfinished' | 'finished') =>
    request<{ workouts: Workout[] }>(`/workouts${status ? `?status=${status}` : ''}`, { token }),
  startWorkout: (token: string) =>
    request<{ workout: Workout }>('/workouts', { method: 'POST', token }),
  workout: (token: string, id: string) =>
    request<{ workout: Workout }>(`/workouts/${id}`, { token }),
  lastWorkout: (token: string) => request<{ workout: Workout }>('/workouts/last', { token }),
  saveWorkout: (
    token: string,
    id: string,
    exercises: {
      exerciseId: string;
      sets: { weightKg?: number | null; reps?: number | null; seconds?: number | null; distanceM?: number | null }[];
    }[],
  ) => request<{ workout: Workout }>(`/workouts/${id}`, { method: 'PUT', body: { exercises }, token }),
  finishWorkout: (token: string, id: string) =>
    request<{ workout: Workout }>(`/workouts/${id}/finish`, { method: 'POST', token }),
  deleteWorkout: (token: string, id: string) =>
    request<null>(`/workouts/${id}`, { method: 'DELETE', token }),
  cookRecipe: (
    token: string,
    id: string,
    overrides: {
      name?: string;
      portions?: number;
      ingredients?: { foodId: string; grams: number }[];
    } = {},
  ) => request<{ batch: Batch }>(`/recipes/${id}/cook`, { method: 'POST', body: overrides, token }),
  eatPortion: (token: string, id: string, input: { date: string; meal: Meal }) =>
    request<{ batch: Batch; entry: LogEntry }>(`/batches/${id}/eat`, {
      method: 'POST',
      body: input,
      token,
    }),
  diary: (token: string, date: string) =>
    request<{ entries: LogEntry[] }>(`/diary?date=${date}`, { token }),
  diarySummary: (token: string, date: string) =>
    request<{ summary: DiarySummary }>(`/diary/summary?date=${date}`, { token }),
};
