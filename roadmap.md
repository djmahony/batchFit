# BatchFit — Delivery Roadmap

A build order for the MVP, broken into **Phases → Features → Tasks**.

- **Feature** = a testable milestone. At the end of one, you can exercise it end-to-end
  (via the app, or via the API for backend-only features).
- **Task** = the smallest unit that makes sense to review: **one branch, one PR, small commits.**
- We build **backend-first, then the frontend** for each section, alternating, so every
  slice is testable before the UI depends on it.

Tick tasks off as they merge. `[ ]` = todo, `[x]` = merged.

---

## Current status

_Last updated: 2026-07-15._

**Baseline already on `main` (pre-roadmap scaffolding):** a monorepo with two folders —
- `app/` — Expo SDK 57 + Expo Router. Five placeholder tabs (Today, Diary, Prep, Train,
  Progress), each a shared `ScreenScaffold` empty state. Typechecks; runs in Expo Go.
- `api/` — Express + TypeScript + Prisma (SQLite). Scaffolded `/health`, `/foods`, `/batches`
  routes with per-portion macro maths (`src/macros.ts`); initial migration applied. Typechecks.

**Completed roadmap tasks:**
- [x] **P0-1** — GitHub remote + PR workflow (`origin` = `github.com:djmahony/batchFit.git`,
  `gh` authed, `main` pushed).
- [x] **P0-2** — API test harness (Vitest + Supertest, `npm test` in `api/`, `/health` test
  green). App split into `src/app.ts` (exported) + `src/index.ts` (listen) for testability.
- [x] **P0-3** — Reconciled `CLAUDE.md` and `mvp-spec.md` with the client–server +
  accounts-from-day-one approach (offline/local-first framing superseded; cloud *sync* only
  remains later; auth screens precede onboarding).
- [x] **F1-1** — User & profile data model. `User` Prisma model (email unique, passwordHash,
  profile + the five targets, `onboardingComplete`) + `add_user` migration. Profile/target
  fields live on `User` (1:1), nullable until onboarding; weight/height stored in metric.
- [x] **F1-2** — Auth infrastructure. `src/auth/`: bcryptjs password hash/verify, JWT
  sign/verify helpers (`JWT_SECRET`, 7-day tokens), and `requireAuth` middleware that sets
  `req.userId`. Unit tests on the password + JWT round-trips.
- [x] **F1-3** — `POST /auth/register`. Validates email/password, hashes, creates the user,
  returns token + serialized user (no hash). Also set up the endpoint-test DB harness
  (isolated `test.db`, schema pushed in `globalSetup`, tables cleared per test).
- [x] **F1-4** — `POST /auth/login`. Verifies credentials (case-insensitive email), returns
  token + serialized user; unknown email and wrong password both 401 (no user enumeration).
- [x] **F1-5** — `GET /me`. Protected route returning the serialized current user; 404 if the
  user no longer exists, 401 without a valid token.
- [x] **F1-6** — TDEE calculator. Pure `src/tdee.ts` (Mifflin–St Jeor BMR → maintenance → goal
  target → macro split, protein prioritised, floored at BMR) + auth-protected `POST /tools/tdee`
  returning suggested targets from profile inputs. Math unit-tested; endpoint tested.
- [x] **F2-1 → F2-6** — Auth UI slice (frontend). Typed API client (`src/lib/api.ts`), session
  store (`expo-secure-store` token + `AuthProvider`/`useAuth`, restore-on-launch), auth-gated
  navigation (`Stack.Protected`: logged-in → `(tabs)`, logged-out → `(auth)`), and the Welcome,
  Register, and Login screens wired to the live API. Shared `Button`/`TextField` components.
  Register/login validate client-side, surface API errors inline, and let the guard swap to the
  app on success. Screens are **styled to the design mockups** (`batchFitDesignWork/`): Prep Green
  palette on Paper/Deep Kale, Schibsted + Hanken fonts, logo mark on Welcome. The API client
  times out after 12s so an unreachable server shows an error instead of hanging. **Verified on
  device** (register → app; sign out → Welcome; relaunch stays logged in).
  - **Note:** a freshly-registered user currently lands straight in `(tabs)` — onboarding
    (F2-7→9) isn't built yet, so `onboardingComplete` isn't gated on.
  - **Temporary scaffolding to remove later:** a "Sign out" link on the **Progress** tab (real
    logout belongs in Settings), and `app/.env.local` points the app at the dev API's LAN IP.

**Next up (in order):** **F1-7** (Save onboarding — `PUT /me/profile`) → **F2-7** (Onboarding:
Goal) → **F2-8** (Onboarding: About you) → **F2-9** (Onboarding: Targets). When onboarding lands,
re-gate navigation on `onboardingComplete`. Confirm which to start when resuming.

**Workflow reminder:** every task is its own branch → small commits as you go → push the
branch → open a PR into `main` for review. Do **not** commit feature work straight to `main`.

---

## Working agreement

- **One branch + one PR per task.** Base branch is `main`.
- **Branch naming:** `feat/<area>-<slug>` (e.g. `feat/api-auth-register`, `feat/app-login-screen`).
  Use `chore/`, `fix/`, `docs/` where appropriate.
- **Commits:** small and frequent, present-tense summaries. No need to ask permission to commit.
- **Definition of done for a task:** code compiles (`tsc --noEmit` in the touched project),
  any tests added pass, the PR is opened against `main` with a short description of what to review.
- **Definition of done for a feature:** all its tasks merged, and the "Verification" steps pass.

### Note on approach (read this)

This roadmap builds BatchFit as a **client–server app with user accounts from day one**
(API-backed auth + onboarding first). That is a deliberate departure from `mvp-spec.md` /
`CLAUDE.md`, which describe a **fully offline, single-user, local-first** MVP with accounts
deferred to Phase 3. Consequences to accept:

- The app now **depends on the API** to function (login required before use).
- "Offline-first / no network" is no longer a Phase-1 constraint.
- `CLAUDE.md` and `mvp-spec.md` should be updated to reflect this — tracked as **P0-3** below.

### Out of scope for this roadmap (later)

Barcode scanning, adaptive targets, cloud media/progress photos, Postgres migration &
production hosting, monetisation, push notifications. These are Phase-2/3 business items.

---

## Phase 0 — Prerequisites

Small groundwork that unblocks the workflow. Needed once.

- [x] **P0-1 — GitHub remote + PR workflow.** ✅ Done. `origin` =
  `github.com:djmahony/batchFit.git`, `gh` authenticated (account `djmahony`, `repo` scope),
  `main` pushed.
- [x] **P0-2 — API test harness.** ✅ Done. Vitest + Supertest added to `api/` with a `test`
  script (`vitest run`); `src/health.test.ts` exercises `/health`. App is split into
  `src/app.ts` (exported Express app) and `src/index.ts` (starts the listener) so tests can
  import the app without binding a port.
- [x] **P0-3 — Reconcile the docs.** ✅ Done. Updated `CLAUDE.md` and `mvp-spec.md` to reflect
  the client-server + accounts-from-day-one approach (see note above): offline/local-first and
  accounts-in-Phase-3 framing superseded, only cross-device **sync** stays later, and auth
  screens (Welcome → Register / Login) now precede onboarding.

**Verification:** `origin` is set and `main` is pushed; `npm test` runs green in `api/`.

---

## Phase 1 — Accounts & Onboarding

### Feature F1 — Auth & Onboarding API (backend)

Register, log in, and store the profile + calorie/macro targets onboarding produces.
Auth is **JWT**: register/login return an access token; protected routes require it.

- [x] **F1-1 — User & profile data model.** ✅ Done. `User` Prisma model + `add_user`
  migration: email (unique), passwordHash, timestamps, profile (sex, birthDate, heightCm,
  activityLevel, goal, goalRateKgPerWk, current/goal weight, units) and the five targets
  (kcal/protein/fat/carbs/fibre), plus `onboardingComplete`. Profile/target fields sit on
  `User` (1:1), nullable until onboarding; weight/height stored canonically in metric.
- [x] **F1-2 — Auth infrastructure.** ✅ Done. `src/auth/`: `password.ts` (bcryptjs
  hash/verify), `jwt.ts` (sign/verify, `JWT_SECRET` with dev fallback, 7-day TTL), and
  `requireAuth.ts` (Bearer-token middleware populating `req.userId`, 401 otherwise). Unit
  tests cover the password + JWT round-trips.
- [x] **F1-3 — `POST /auth/register`.** ✅ Done. Validates email (format) + password
  (min 8 chars), normalises email to lowercase, hashes, creates the user, returns
  `{ token, user }` (user serialized without `passwordHash`); duplicate email → 409. Tests
  cover success + duplicate/invalid-email/short-password. Established the endpoint-test DB
  harness (`vitest.config.ts` points Prisma at `test.db`; `globalSetup` recreates the schema).
- [x] **F1-4 — `POST /auth/login`.** ✅ Done. Looks up the user by normalised email, verifies
  the password, returns `{ token, user }` (serialized). Unknown email and wrong password both
  return the same `401` (no user enumeration); missing fields → 400. Tests cover all four.
- [x] **F1-5 — `GET /me`.** ✅ Done. Protected route (`requireAuth`) returning
  `{ user }` — the serialized current user (profile, targets, `onboardingComplete`),
  looked up by `req.userId`; 404 if the user no longer exists, 401 without a valid token.
  Tests cover success + missing/invalid token.
- [x] **F1-6 — TDEE calculator.** ✅ Done. Pure `src/tdee.ts`: Mifflin–St Jeor BMR × activity
  multiplier → maintenance; goal + `goalRateKgPerWk` (7700 kcal/kg) → target calories, floored
  at BMR; macro split with protein prioritised (2 g/kg), fat at 25% of kcal, carbs as the
  remainder, fibre at 14 g/1000 kcal. `POST /tools/tdee` (auth-protected) validates the profile
  inputs, derives age from `birthDate`, and returns `{ bmr, maintenanceKcal, targets }`. Unit
  tests pin the math (incl. the BMR floor + female constant); endpoint tests cover the wiring,
  401, and validation.
- [ ] **F1-7 — Save onboarding.** `PUT /me/profile` persists goal + profile + targets and
  sets `onboardingComplete`. (+test)

**Verification:** with `curl`/REST client — register → login → `POST /tools/tdee` →
`PUT /me/profile` → `GET /me` returns the saved profile with `onboardingComplete: true`.
Protected routes 401 without a token.

### Feature F2 — Auth & Onboarding UI (frontend)

The screens that let a user sign up, log in, and complete onboarding against F1.

- [x] **F2-1 — API client.** ✅ Done. `src/lib/api.ts`: typed `fetch` wrapper (base URL from
  `EXPO_PUBLIC_API_URL` with simulator fallbacks, JSON, bearer-token injection, `ApiError`
  carrying status + server message). Exposes `register`/`login`/`me` + `User`/`AuthResponse`.
- [x] **F2-2 — Auth session store.** ✅ Done. Token in `expo-secure-store` (localStorage on web);
  `AuthProvider`/`useAuth` exposing `user`, `isLoading`, `signIn`, `register`, `signOut`;
  restore-on-launch (token → `GET /me`, clearing invalid tokens).
- [x] **F2-3 — Auth-gated navigation.** ✅ Done. Root layout wraps `AuthProvider` and routes with
  `Stack.Protected`: `!!user` → `(tabs)`, `!user` → `(auth)`; splash held while the session
  restores. **Note:** `onboardingComplete` is not gated yet (no onboarding screens) — new users
  land in `(tabs)`; re-gate when F2-7→9 land.
- [x] **F2-4 — Welcome screen.** ✅ Done. Wordmark, "Plan it. Batch it. Burn it." tagline,
  "Get started" → register, "I have an account" → login. Adds shared `Button`.
- [x] **F2-5 — Register screen.** ✅ Done. Email/password form, client-side validation mirroring
  the API, inline `ApiError` messages, loading state → `register` → guard swaps to the app.
  Adds shared `TextField`.
- [x] **F2-6 — Login screen.** ✅ Done. Form → `signIn`; surfaces the API's 401 inline, loading
  state → guard swaps to the app on success.
- [ ] **F2-7 — Onboarding: Goal.** Lose / Maintain / Build cards (+ rate for weight loss); held in flow state.
- [ ] **F2-8 — Onboarding: About you.** Sex, age, height, current weight, activity; metric/imperial toggle.
- [ ] **F2-9 — Onboarding: Targets.** Calls `/tools/tdee`, shows calorie hero + macro set,
  allows manual override, confirm → `PUT /me/profile` → enters the app.

**Verification:** on a device via Expo Go — fresh signup → onboarding → land in Today;
kill & reopen the app stays logged in; sign out returns to Welcome.

---

## Phase 2 — Food logging (Diary)

Reference foods, custom foods, and the daily food log. Foundation for Prep and Today.

### Feature F3 — Food & Diary API (backend)

- [ ] **F3-1 — Scope existing food routes to users + custom foods.** Add ownership so a user
  can create custom foods; keep shared reference foods. Extend the scaffolded `/foods` routes.
- [ ] **F3-2 — Food search endpoint.** `GET /foods?query=` across reference + the user's foods.
- [ ] **F3-3 — Diary model.** `LogEntry` (user, date, meal group, food, quantity/unit,
  snapshotted macros) + migration.
- [ ] **F3-4 — Log CRUD.** `POST /diary` (add), `GET /diary?date=`, `PATCH`/`DELETE /diary/:id`. (+tests)
- [ ] **F3-5 — Daily totals.** `GET /diary/summary?date=` returns consumed vs. target for the five nutrients. (+test)

**Verification:** log foods to meals for a day via API; summary totals are correct; editing/deleting updates them.

### Feature F4 — Food & Diary UI (frontend)

- [ ] **F4-1 — Shared: Macro Ring/Bar set.** Build the reusable macro component (calories hero,
  protein prioritised, remaining-vs-target + total modes). Reused everywhere after this.
- [ ] **F4-2 — Shared: Date selector.** Day strip / `< date >` header, defaults to today.
- [ ] **F4-3 — Diary screen.** Meal groups (B/L/D/Snacks), per-meal subtotals, pinned daily totals bar.
- [ ] **F4-4 — Add-food search flow.** Search + Recents/Favourites/My foods tabs → results.
- [ ] **F4-5 — Food detail / quantity.** Quantity control + live macros → add to meal/day.
- [ ] **F4-6 — Create custom food.** Form (name, serving, per-serving macros) → saves & logs.
- [ ] **F4-7 — Edit / delete entry.** Tap to edit quantity; swipe to delete.

**Verification:** on device — add, edit, delete foods across meals; totals and the rings update live.

---

## Phase 3 — Prep: batch cooking ⭐ (the differentiator)

Recipes (templates) and batches (cooks with snapshotted amounts + portion inventory).
The `/foods` and `/batches` scaffolding already exists — these tasks extend it.

### Feature F5 — Prep API (backend)

- [ ] **F5-1 — Scope batches to users** and return total + per-portion macros (extend existing routes). (+tests)
- [ ] **F5-2 — Recipes.** `Recipe`/`RecipeIngredient` routes: list/create/get/update; per-portion
  macros from default amounts.
- [ ] **F5-3 — Cook a recipe → batch.** `POST /recipes/:id/cook` pre-fills a batch (editable amounts) into inventory.
- [ ] **F5-4 — Eat a portion → diary.** `POST /batches/:id/eat` logs a portion to the diary
  **and** decrements remaining (integrates F3). (+test for the decrement + log)
- [ ] **F5-5 — Inventory & history.** Active (remaining > 0) vs. depleted; adjust-remaining endpoint.

**Verification:** create a batch → per-portion macros correct → eat one → diary gains an entry &
count drops → deplete → moves to history.

### Feature F6 — Prep UI (frontend)

- [ ] **F6-1 — Inventory view.** Active batch cards (portions remaining hero, kcal+protein, "Eat one"), low-stock flag.
- [ ] **F6-2 — Batch detail.** Per-portion macros, whole-batch totals, ingredient snapshot, eat/adjust/duplicate/delete.
- [ ] **F6-3 — Create/Edit batch flow.** Start → add ingredients → set portions (live per-portion
  macros) → review → "Add to inventory" → success. Optional "Save as recipe".
- [ ] **F6-4 — Recipes list + detail.** Cards with default per-portion macros; "Cook this" → F6-3 pre-filled.

**Verification:** on device — prep a batch, watch per-portion macros update as portions change,
eat one from inventory and see it in the Diary.

---

## Phase 4 — Train (workout logging)

Co-equal pillar with food logging. Exercises, sessions, history.

### Feature F7 — Train API (backend)

- [ ] **F7-1 — Exercise model + library.** `Exercise` (name, muscle group, equipment, tracking
  mode) + CRUD; seed common exercises. (+tests)
- [ ] **F7-2 — Workout session model.** `Workout` + `WorkoutExercise` + `Set` (weight×reps,
  bodyweight, time, distance modes) + migration.
- [ ] **F7-3 — Session CRUD.** Create/finish/list/get, including unfinished-session state. (+tests)
- [ ] **F7-4 — Repeat-last-workout.** Endpoint returning the previous session's exercises/sets to pre-fill.

**Verification:** create a session, add exercises/sets, finish, list history; repeat-last returns prior numbers.

### Feature F8 — Train UI (frontend)

- [ ] **F8-1 — Shared: numeric keypad entry.** Fast thumb-friendly numeric input (reused by weights/reps).
- [ ] **F8-2 — Train home / history.** "Start workout", unfinished-session banner, history list.
- [ ] **F8-3 — Active session.** Exercise blocks, set tables, "+ add set" (pre-fill), "repeat last time", finish.
- [ ] **F8-4 — Exercise picker / library.** Searchable list + create/edit exercise.

**Verification:** on device — start a workout, log sets, finish; resume an unfinished session; repeat last time works.

---

## Phase 5 — Progress & Settings

Bodyweight trend, stats, and editing what onboarding set.

### Feature F9 — Progress & Settings API (backend)

- [ ] **F9-1 — Weight entries.** `WeightEntry` (date, value, note) + CRUD. (+tests)
- [ ] **F9-2 — Trend & stats.** `GET /progress` returns raw points + smoothed trend + change-over-range
  + simple weekly stats. (+test on the smoothing)
- [ ] **F9-3 — Settings persistence.** Reuse/extend `PUT /me/profile` for goal/targets/profile/units edits.

**Verification:** log weights, fetch trend/stats; update targets and see `/me` reflect them.

### Feature F10 — Progress & Settings UI (frontend)

- [ ] **F10-1 — Progress screen.** Trend chart (raw points + emphasised trend line), range toggle,
  current/goal, "Log weight".
- [ ] **F10-2 — Log weight modal.** Date/value/unit/note; edit/delete.
- [ ] **F10-3 — Settings screen.** Goals & targets, profile, preferences (units), data (export/clear), about.
- [ ] **F10-4 — TDEE calculator screen.** Reused component (onboarding + settings) to recompute targets.

**Verification:** on device — log several weights, see the trend; change a target in Settings and see rings update app-wide.

---

## Phase 6 — Today dashboard (integration)

Built last because it aggregates every domain above.

### Feature F11 — Today API (backend)

- [ ] **F11-1 — Daily summary endpoint.** `GET /today?date=` composing budget (targets vs. intake),
  meal subtotals, inventory snapshot, and weight mini-trend in one payload. (+test)

**Verification:** returns a correct combined snapshot for a day with logged food, a batch, and a weight.

### Feature F12 — Today UI (frontend)

- [ ] **F12-1 — Daily budget hero.** Macro Ring set for calories remaining + macros.
- [ ] **F12-2 — Quick actions row.** Log food · Eat a prepped meal · Start workout · Log weight.
- [ ] **F12-3 — Today's meals summary.** Meal groups with subtotals → jump to Diary.
- [ ] **F12-4 — Inventory snapshot card.** "X prepped meals ready" + "Eat one" / view inventory.
- [ ] **F12-5 — Bodyweight mini-trend.** Sparkline + latest value + "Log weight".

**Verification:** on device — the Today tab reflects everything logged elsewhere and every card routes correctly.

---

## MVP done

After F12: a logged-in user can onboard, log food, prep batches and eat from inventory,
log workouts, track bodyweight, and see it all summarised on Today — end to end, on a device.
Next up would be the Phase-2 business items listed under "Out of scope" above.
