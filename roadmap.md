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
  - **Temporary scaffolding:** `app/.env.local` points the app at the dev API's LAN IP. (The
    temporary Progress-tab "Sign out" link moved to Settings in F10-3.)
- [x] **F1-7** — Save onboarding. `PUT /me/profile` (auth-protected) validates and persists
  goal (+ weekly rate, nulled for maintain), profile, units and the five targets, sets
  `onboardingComplete`, returns the serialized user. Endpoint-tested.
- [x] **F2-7 → F2-9** — Onboarding UI (frontend). `(onboarding)` route group, gated in the root
  layout: logged-in **without** `onboardingComplete` → onboarding; **with** → `(tabs)` (the
  re-gate). Flow state lives in `OnboardingProvider`; screens styled to
  `BatchFit Onboarding.dc.html` (light + dark): **Goal** (Lose/Maintain/Build choice cards,
  gentle/moderate/aggressive rate picker for lose), **About you** (metric/imperial toggle that
  converts typed values, sex, age/height/weight rows, five activity levels with plain-language
  descriptions), **Targets** (calls `/tools/tdee`, calorie hero ring + protein/carbs/fat cards +
  fibre row — all manually editable — then "Looks good" → `PUT /me/profile` → the guard swaps
  into the app). Adds shared `Segmented`, `ChoiceCard`, `OnboardingStep` components and new
  mockup-sourced theme tokens.
  - **Decisions to revisit:** "build" uses a fixed gentle surplus (0.25 kg/wk) since the rate
    picker only shows for weight loss; the spec's optional "skip setup" affordance and "Ready"
    micro-screen were not built (not roadmap tasks); the calorie ring is a plain single-colour
    ring until the real Macro Ring set lands (F4-1).

- [x] **F3-1** — `/foods` scoped to users + custom foods (`Food.ownerId`, auth-required
  routes, macro validation; see Phase 2 below).
- [x] **F3-2** — Food search (`GET /foods?query=`) + reference-food seed library.
- [x] **F3-3** — Diary model (`LogEntry`, day-key dates, snapshotted macros).
- [x] **F3-4** — Diary log CRUD (`POST/GET/PATCH/DELETE /diary`, snapshot-preserving edits).
- [x] **F3-5** — Daily totals (`GET /diary/summary?date=`: consumed vs. targets vs. remaining).
  **Feature F3 complete** — the Food & Diary API is exercisable end-to-end.

- [x] **F4-1** — Macro Ring/Bar set (`src/components/macros.tsx`, react-native-svg).
- [x] **F4-2** — Date selector pill + day-key helpers (`src/lib/dates.ts`).
- [x] **F4-3** — Diary screen (budget hero + bar, meal groups, entry cards, four states).
- [x] **F4-4** — Add-food search modal (Recents via new `GET /foods/recent`, My foods, search).
- [x] **F4-5** — Food detail/quantity (`(logging)` modal group, live ring, add to diary).
- [x] **F4-6** — Create custom food (per-serving form → per-100g save → straight into logging).
- [x] **F4-7** — Edit/delete entry (tap → `/entry/[id]`, snapshot-rescaled preview, delete).
  **Feature F4 complete** — Phase 2 (food logging) is done end-to-end.

- [x] **F5-1** — Batches scoped to users (ownership + validation + per-portion macros, tested).
- [x] **F5-2** — Recipes (owned templates; list/get/create/update; per-portion macros).
- [x] **F5-3** — Cook a recipe → batch (`POST /recipes/:id/cook`, overridable pre-fill).
- [x] **F5-4** — Eat a portion → diary (transactional log + decrement; unit `"portion"`).
- [x] **F5-5** — Inventory & history (status filter, adjust-remaining, delete; diary intact).
  **Feature F5 complete.**

- [x] **F6-1** — Inventory view (batch cards, pips, Eat one, LOW flag, history, empty state).
- [x] **F6-2** — Batch detail (per-portion hero, ingredients, eat/adjust/duplicate/delete).
- [x] **F6-3** — Create batch wizard (4 steps + green confirmation; save-as-recipe toggle).
- [x] **F6-4** — Recipes list + detail ("Cook this" pre-fills the wizard). **F6 complete.**

- [x] **F7-1** — Exercise model + seeded library + CRUD (library read-only).
- [x] **F7-2** — Workout session models (Workout → WorkoutExercise → WorkoutSet).
- [x] **F7-3** — Session CRUD (start/resume, PUT structure, finish, list/get/delete).
- [x] **F7-4** — Repeat-last-workout (`GET /workouts/last`). **Feature F7 complete.**

- [x] **F8-1** — Numeric keypad component.
- [x] **F8-2** — Train home/history (start, resume banner, history list).
- [x] **F8-3** — Active session (set tables + keypad, add-set pre-fill, repeat-last, finish).
- [x] **F8-4** — Exercise picker/library (search, create/edit own). **F8 complete.**

- [x] **F9-1** — Weight entries (day-upsert CRUD).
- [x] **F9-2** — Trend & stats (`GET /progress`: EMA trend + range stats).
- [x] **F9-3** — Settings persistence (`PATCH /me/profile`, partial edits). **F9 complete.**

- [x] **F10-1** — Progress screen (trend chart, range chips, this-week stats).
- [x] **F10-2** — Log weight sheet (kg/lb converting toggle, note, edit/delete).
- [x] **F10-3** — Settings (targets/profile editors, units, sync hook, sign out).
- [x] **F10-4** — TDEE calculator screen (recompute + use targets). **F10 complete.**

- [x] **F11-1** — `GET /today` composition endpoint. **F11 complete.**

**Next up (in order):** Phase 6 — Feature F12 (Today UI): **F12-1** (budget hero) → **F12-2**
(quick actions) → **F12-3** (meals summary) → **F12-4** (inventory card) → **F12-5** (weight
mini-trend). Then the MVP is done.

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
- [x] **F1-7 — Save onboarding.** ✅ Done. `PUT /me/profile` validates (enums, positive
  numbers, birth date) and persists goal + profile + targets, nulls the weekly rate for
  maintain, sets `onboardingComplete`, returns the serialized user. Tests cover the save,
  validation failures, and 401.

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
- [x] **F2-7 — Onboarding: Goal.** ✅ Done. Lose (with gentle/moderate/aggressive rate picker) /
  Maintain / Build choice cards; selection held in `OnboardingProvider` flow state.
- [x] **F2-8 — Onboarding: About you.** ✅ Done. Sex, age, height, current weight, five activity
  levels with descriptions; metric/imperial toggle converts what's typed; metric sent to the API.
- [x] **F2-9 — Onboarding: Targets.** ✅ Done. Calls `/tools/tdee`, shows the calorie hero ring +
  macro cards + fibre (all editable for manual override), "Looks good" → `PUT /me/profile` →
  the root guard (now gated on `onboardingComplete`) swaps into the app.

**Verification:** on a device via Expo Go — fresh signup → onboarding → land in Today;
kill & reopen the app stays logged in; sign out returns to Welcome.

---

## Phase 2 — Food logging (Diary)

Reference foods, custom foods, and the daily food log. Foundation for Prep and Today.

### Feature F3 — Food & Diary API (backend)

- [x] **F3-1 — Scope existing food routes to users + custom foods.** ✅ Done. `Food.ownerId`
  (nullable — null = shared reference food) + `add_food_owner` migration. `/foods` now requires
  auth: GET returns reference + the caller's own foods; POST creates a food owned by the caller
  and validates all five macros as non-negative numbers. Responses wrapped as `{ foods }` /
  `{ food }`. Tests cover visibility scoping, creation, validation, and 401s.
- [x] **F3-2 — Food search endpoint.** ✅ Done. `GET /foods?query=` filters the visible set
  (reference + own) by name or brand, case-insensitive (SQLite LIKE), capped at 50 results;
  blank query returns everything. Seed expanded to ~58 reference foods (idempotent — skips if
  reference foods exist). Tests cover matching, scoping, blank query, and no-match.
- [x] **F3-3 — Diary model.** ✅ Done. `LogEntry` + `add_log_entry` migration: user (cascade),
  `date` day-key string ("YYYY-MM-DD"), meal ("breakfast"|"lunch"|"dinner"|"snacks"), snapshotted
  `name`, optional food link (SetNull on delete), quantity/unit, and the five macros snapshotted
  **for the logged quantity** — history never rewrites. Indexed on `[userId, date]`.
- [x] **F3-4 — Log CRUD.** ✅ Done. Auth-scoped `/diary` routes: `POST` (validates day-key/
  meal/quantity, food must be visible to the caller, snapshots name + macros scaled to grams),
  `GET ?date=`, `PATCH /:id` (quantity change rescales the **snapshot** proportionally — never
  re-reads the live food; meal/date moves), `DELETE /:id`. Other users' entries/foods → 404.
  Tests cover snapshot immutability after food edits, scoping, validation, all verbs.
- [x] **F3-5 — Daily totals.** ✅ Done. `GET /diary/summary?date=` aggregates the day's
  entries into `{ consumed, targets, remaining }` for the five nutrients; targets/remaining are
  null before onboarding sets them; remaining may go negative (client phrases it kindly).
  Tests cover totals, live updates after edit/delete, null targets, validation.

**Verification:** log foods to meals for a day via API; summary totals are correct; editing/deleting updates them.

### Feature F4 — Food & Diary UI (frontend)

- [x] **F4-1 — Shared: Macro Ring/Bar set.** ✅ Done. `src/components/macros.tsx`
  (react-native-svg): `MacroRing` (SVG donut, segments clockwise from 12; total mode fills the
  ring, remaining-vs-target mode leaves track; centre takes children), `macroSegments` (splits
  P/C/F by 4/4/9 kcal), `MacroBar` (thin budget bar), `MacroLegendRow` (dot+label+value, protein
  emphasised). New theme tokens `macroProtein`/`macroCarbs`/`barTrack` from the Diary mockup.
- [x] **F4-2 — Shared: Date selector.** ✅ Done. `src/components/date-selector.tsx` — the
  `‹ Wed 12 Jun ›` pill from the day-log mockup (Today/Yesterday/Tomorrow for nearby days) —
  plus local-time day-key helpers in `src/lib/dates.ts` (`todayKey`, `shiftDayKey`,
  `formatDayKey`; local time so "today" stays honest around midnight).
- [x] **F4-3 — Diary screen.** ✅ Done. Styled to mockup 1g/2g: header + date selector, kcal
  budget hero card (logged / target, "left"—or "over" in coral, never shaming copy—plus thin
  MacroBar), four meal groups with per-meal kcal subtotals, entry cards (name, grams · protein,
  kcal), dashed per-meal "Add food" rows (wired in F4-4). Pull-to-refresh + refetch-on-focus;
  loading / error+retry / empty-meal states. API client gains diary/diarySummary + types.
- [x] **F4-4 — Add-food search flow.** ✅ Done. Modal `/add-food?meal&date` (mockup 1h/2h):
  ✕ + "Add to <Meal>" header, debounced search over all visible foods, Recents / My foods chips
  when the field is empty (Recents backed by new `GET /foods/recent` — most recently logged,
  deduped, endpoint-tested), barcode Phase-2 slot, result rows with kcal + green add bubble →
  food detail (F4-5), "No match? Create a custom food" footer → F4-6. Diary add rows now open it.
  - **Decision to revisit:** Favourites chip deferred — no favourite flag in the data model
    (needs its own task); spec's "My recipes/batches" source arrives with Prep (F6).
- [x] **F4-5 — Food detail / quantity.** ✅ Done. `/food/[id]` inside a new `(logging)` modal
  route group (search → detail → create push within one sheet). Styled to mockup 1i/2i: grams
  stepper (±10g, editable), live MacroRing card on the hero surface with protein-emphasised
  legend, "Updates live…" caption, expandable Meal + Date rows, "Add to diary" → `POST /diary`
  → the sheet dismisses and Diary refetches on focus. API adds `GET /foods/:id` (+tests).
  - **Decision to revisit:** quantity is grams-only (foods are per-100g); serving/portion units
    from the mockup's toggle arrive with recipes/batches (F5/F6).
- [x] **F4-6 — Create custom food.** ✅ Done. `/create-food` (mockup 1j/2j): name, serving
  size (grams), PER SERVING calories/protein/carbs/fat + optional fibre (blank = 0). Converts
  per-serving → per-100g for `POST /foods`, then replaces into `/food/[id]` pre-filled with one
  serving so saving flows straight into logging. Client-side validation with kind copy.
- [x] **F4-7 — Edit / delete entry.** ✅ Done. Diary entries are tappable → `/entry/[id]`
  (same sheet visual language as food detail): grams stepper + live ring **rescaled from the
  entry's own snapshot** (mirrors the API's PATCH maths — the live food is never re-read), meal
  mover, "Delete entry" destructive row, "Save changes". Batch-portion entries (F5-4) show a
  fixed portion note instead of a grams stepper. API adds `GET /diary/:id` (+test).
  - **Decision to revisit:** swipe-to-delete fast path not built (tap → delete covers MVP).

**Verification:** on device — add, edit, delete foods across meals; totals and the rings update live.

---

## Phase 3 — Prep: batch cooking ⭐ (the differentiator)

Recipes (templates) and batches (cooks with snapshotted amounts + portion inventory).
The `/foods` and `/batches` scaffolding already exists — these tasks extend it.

### Feature F5 — Prep API (backend)

- [x] **F5-1 — Scope batches to users.** ✅ Done. `Batch.ownerId` + `add_batch_owner`
  migration (nullable only so pre-ownership rows survive; API always sets it, unowned rows are
  invisible). All `/batches` routes require auth and filter by owner; POST validates portions/
  ingredients and requires every ingredient food to be visible to the caller; responses wrapped
  `{ batches }`/`{ batch }` with total + per-portion macros. Seed no longer creates an example
  batch. Full endpoint tests (macros maths, validation, scoping, eat decrement/409).
- [x] **F5-2 — Recipes.** ✅ Done. `Recipe.ownerId` (+ migration) and auth-scoped `/recipes`:
  list (A→Z) / get / create / **PUT update** (replaces name, portions and the full ingredient
  list transactionally — cooked batches are untouched, they snapshot). Same validation as
  batches (positive grams, visible foods). Total + per-portion macros from default amounts.
  Endpoint-tested (macros, validation, scoping, update).
- [x] **F5-3 — Cook a recipe → batch.** ✅ Done. `POST /recipes/:id/cook` — the recipe's
  defaults pre-fill the batch; the body may override name/portions/ingredients (real cooking
  varies). Creates an owned batch with `recipeId` linked, snapshotting what was actually used;
  the template is untouched. Also hardened the test harness: shared `resetDb()` clears all
  tables FK-safely per test (cross-file leftovers were breaking suites). Tested (defaults,
  overrides, validation, scoping).
- [x] **F5-4 — Eat a portion → diary.** ✅ Done. `POST /batches/:id/eat` now logs a diary
  entry (name = batch name, quantity 1, unit `"portion"`, macros snapshotted per-portion) **and**
  decrements `portionsRemaining` in one transaction. Body `{ date?, meal? }` defaults to
  today/snacks. 409 at zero logs nothing. Tests cover the log+decrement, diary/summary
  integration, defaults, validation, and scoping.
- [x] **F5-5 — Inventory & history.** ✅ Done. `GET /batches?status=active|depleted` splits
  the live inventory from finished cooks; `PATCH /batches/:id` adjusts `portionsRemaining`
  (integer 0..total); `DELETE /batches/:id` removes a cook — eaten diary entries stay exactly
  as logged in both cases. Tested (filtering, adjust bounds, delete-keeps-diary, scoping).
  **Feature F5 complete** — the Prep API is exercisable end-to-end.

**Verification:** create a batch → per-portion macros correct → eat one → diary gains an entry &
count drops → deplete → moves to history.

### Feature F6 — Prep UI (frontend)

- [x] **F6-1 — Inventory view.** ✅ Done. Prep tab rebuilt to mockup 1k/2k/1t: Inventory/
  Recipes segmented (Recipes filled in F6-4), meals-ready hero strip with "~N days stocked"
  chip (3 meals/day), "New batch" CTA, batch cards (portion pips, remaining hero number,
  kcal + protein, one-tap **Eat one** → `POST /batches/:id/eat` with today + time-of-day meal),
  LOW flag + coral treatment at ≤2 portions, clock icon flips to depleted history, mockup empty
  state. Diary entries with unit `portion` now carry the coral **BATCH** tag (mockup 1g).
  Client gains `Batch` types, `batches()`/`eatPortion()`, `mealForNow`/`cookedAgo` helpers.
- [x] **F6-2 — Batch detail.** ✅ Done. `/batch/[id]` to mockup 1l/2l: cooked-ago +
  remaining-count header, portion pips, per-portion MacroRing hero ("KCAL / PORTION"),
  whole-batch row, ingredient snapshot (kg/g formatting). ⋯ menu → adjust portions left
  (inline −/+ stepper via `PATCH`), duplicate ("cook this again"), delete (confirm; diary
  history untouched). Footer "Eat a portion" (or "Cook this again" when depleted).
- [x] **F6-3 — Create batch flow.** ✅ Done. `(wizard)` modal group (mockups 1m→1q):
  **Start** (name + "new from scratch" / "from a saved recipe" with inline recipe list; a
  `recipeId` param pre-fills and jumps ahead for "Cook this") → **Ingredients** (debounced
  search adds at 100g, inline grams edits, running-total strip) → **Portions ✨** (big coral
  stepper + "PER PORTION · UPDATES LIVE" panel) → **Review** (per-portion hero, whole-batch
  rows, **Save as recipe** toggle) → `POST /batches` (+`/recipes`) → **Confirmation** (full
  Prep-Green "N meals prepped", "Back to inventory" / "Eat one now"). Draft lives in
  `BatchDraftProvider`; shared `WizardStep` chrome.
  - **Decision to revisit:** editing a cooked batch's ingredients isn't supported (no API for
    it — adjust/duplicate/delete cover the MVP); the flow is create-only.
- [x] **F6-4 — Recipes list + detail.** ✅ Done. Prep's Recipes sub-view (mockup 1r/2r):
  "Templates you can cook anytime", recipe cards ("makes N" chip, per-portion kcal + protein,
  **Cook this** → the wizard pre-filled via `?recipeId=`), dashed "New recipe" (opens the wizard
  — save-as-recipe at review), empty state. `/recipe/[id]` detail (mockup 1s/2s): RECIPE chip,
  default portions, per-portion hero, default ingredients, footer "Cook this".
  **Feature F6 complete** — Phase 3 (Prep ⭐) is done end-to-end.
  - **Decisions to revisit:** no standalone recipe editor (PUT `/recipes/:id` exists but the
    UI edits via cook-and-resave); no recipe delete endpoint yet, so no delete action.

**Verification:** on device — prep a batch, watch per-portion macros update as portions change,
eat one from inventory and see it in the Diary.

---

## Phase 4 — Train (workout logging)

Co-equal pillar with food logging. Exercises, sessions, history.

### Feature F7 — Train API (backend)

- [x] **F7-1 — Exercise model + library.** ✅ Done. `Exercise` model (`add_exercise`
  migration): name, muscleGroup, equipment, trackingMode (weight_reps / bodyweight_reps / time
  / distance), `ownerId` null = shared library. `/exercises`: GET (library + own, `?query=`
  name filter), POST custom, PATCH/DELETE own only (library read-only). Seed adds ~43 library
  exercises (idempotent). Tested (scoping, filters, enum validation, library immutability).
- [x] **F7-2 — Workout session model.** ✅ Done. `Workout` (startedAt / nullable finishedAt =
  unfinished, user cascade) → `WorkoutExercise` (ordered blocks; exercise name + trackingMode
  **snapshotted**, SetNull link) → `WorkoutSet` (order + nullable weightKg/reps/seconds/
  distanceM — the block's mode says which apply). `add_workouts` migration.
- [x] **F7-3 — Session CRUD.** ✅ Done. `/workouts`: POST start (returns the existing
  unfinished session instead of forking a second one), GET list newest-first with
  `?status=unfinished|finished`, GET `/:id`, **PUT `/:id`** replaces blocks + sets
  transactionally (name/trackingMode snapshotted from visible exercises; sets validated
  per mode), POST `/:id/finish` (409 if already finished), DELETE `/:id`. Fully tested.
- [x] **F7-4 — Repeat-last-workout.** ✅ Done. `GET /workouts/last` — the most recent
  **finished** session with its blocks + sets, for pre-filling a new one; 404 when nothing has
  been finished yet. Tested. **Feature F7 complete** — the Train API is exercisable end-to-end.

**Verification:** create a session, add exercises/sets, finish, list history; repeat-last returns prior numbers.

### Feature F8 — Train UI (frontend)

- [x] **F8-1 — Shared: numeric keypad entry.** ✅ Done. `NumericKeypad` (wireframe 1v): fixed
  3×4 thumb grid (1–9, ·, 0, ⌫) that never opens the system keyboard; decimal key disabled for
  integer fields (reps/seconds). Wired into the active session in F8-3.
- [x] **F8-2 — Train home / history.** ✅ Done. Train tab (wireframe 1u): "Start workout"
  (POST — resumes rather than forking if one is open), coral **RESUME** banner for the
  unfinished session ("Started N min ago · X exercises"), History list (time-of-day titles,
  weekday · duration, exercise/set counts), pull-to-refresh + focus refetch, empty/error states.
  - **Decision to revisit:** sessions have no user-set name (model has none) — titled
    "Morning/Afternoon/Evening workout" for now.
- [x] **F8-3 — Active session.** ✅ Done. `/workout/[id]` (wireframe 1v): ticking ⏱ timer,
  exercise blocks with per-mode set tables (kg+reps / reps / seconds / metres), tap a cell →
  in-screen **NumericKeypad** edits it (decimal disabled for integer fields), "+ Add set"
  pre-fills from the previous set, "Repeat last workout" pre-fills an empty session from
  `GET /workouts/last`, debounced PUT saves the whole session as it changes (flushed before
  finishing), **Finish workout**, ⋯ → discard. Finished sessions open read-only from history.
- [x] **F8-4 — Exercise picker / library.** ✅ Done. `ExercisePicker` full-screen modal
  (wireframes 1w/1x) inside the session: debounced search over library + own exercises
  ("Chest · Barbell" meta), pencil edits **own** exercises, "+ Create exercise" form (name,
  muscle-group/equipment chip grids, tracking-mode chips) → POST/PATCH. Picking appends a
  block with one empty set; the session's dashed "Add exercise" row opens it.
  **Feature F8 complete** — Phase 4 (Train) is done end-to-end.

**Verification:** on device — start a workout, log sets, finish; resume an unfinished session; repeat last time works.

---

## Phase 5 — Progress & Settings

Bodyweight trend, stats, and editing what onboarding set.

### Feature F9 — Progress & Settings API (backend)

- [x] **F9-1 — Weight entries.** ✅ Done. `WeightEntry` (day-key date, weightKg, note;
  unique per user+day) + `add_weight_entry` migration. `/weights`: POST **upserts** the day
  (a second weigh-in updates, not duplicates), GET oldest-first, PATCH value/note, DELETE.
  Tested (upsert, validation, ordering, scoping).
- [x] **F9-2 — Trend & stats.** ✅ Done. Pure `src/progress.ts`: EMA smoothing (α=0.25 —
  daily noise damped, real change followed) + `progressStats` (current / change-over-range /
  weekly rate from the trend line). `GET /progress?days=N` returns `{ entries, trend, stats }`.
  Smoothing maths unit-tested; endpoint tested incl. the window filter.
- [x] **F9-3 — Settings persistence.** ✅ Done. New `PATCH /me/profile` — any subset of goal /
  profile / units / targets, each field validated as in the PUT; switching to maintain nulls the
  weekly rate; onboarding state untouched; empty patch → 400. Tested. **Feature F9 complete.**

**Verification:** log weights, fetch trend/stats; update targets and see `/me` reflect them.

### Feature F10 — Progress & Settings UI (frontend)

- [x] **F10-1 — Progress screen.** ✅ Done. Progress tab (wireframe 1y): current smoothed
  weight in the user's units + ▼/▲ change over the range, SVG **trend chart** (light raw dots,
  emphasised green trend line), 1M/3M/6M/All chips, "This week" workouts · meals-stocked row,
  gear → Settings. "Log weight" + recent entries arrive with the modal in F10-2.
  - **Decision to revisit:** the wireframe's "Avg calories" this-week stat needs a weekly
    summary endpoint (7 per-day calls otherwise) — deferred.
- [x] **F10-2 — Log weight modal.** ✅ Done. `LogWeightSheet` bottom sheet (wireframe 1z):
  date (selector, fixed when editing), value with **kg/lb toggle that converts what's typed**
  (kg sent to the API), optional note, Save (day-upsert). Progress gains the "Log weight" CTA
  and a Recent-entries list — tap to edit, delete inside the sheet.
- [x] **F10-3 — Settings screen.** ✅ Done. `/settings` (wireframe 1aa): rows → **Goals &
  targets** (goal + weekly rate + the five targets, `PATCH`), **Profile** (sex, height,
  current/goal weight in the user's unit, activity level), **Recalculate targets** (F10-4),
  inline **Units** segmented (optimistic PATCH), the dashed "Account & cloud sync — Phase 3"
  hook, About, and **Sign out** (moved here from its temporary spot on Progress).
  - **Decisions to revisit:** "Data — export/clear" row omitted (no API for it yet); height
    stays in cm even for imperial (ft/in entry deferred); birth date isn't editable.
- [x] **F10-4 — TDEE calculator screen.** ✅ Done. `/settings/tdee` (wireframe 1ab): goal
  segmented + rate chips, activity chips, live `POST /tools/tdee` recompute from the stored
  profile, suggestion hero (ring + protein-emphasised legend + maintenance caption), "Use these
  targets" → `PATCH` → rings update app-wide. Points to Profile if body stats are missing.
  **Feature F10 complete** — Phase 5 is done end-to-end.

**Verification:** on device — log several weights, see the trend; change a target in Settings and see rings update app-wide.

---

## Phase 6 — Today dashboard (integration)

Built last because it aggregates every domain above.

### Feature F11 — Today API (backend)

- [x] **F11-1 — Daily summary endpoint.** ✅ Done. `GET /today?date=` composes, in one
  payload: budget (consumed / targets / remaining for the five nutrients), per-meal kcal +
  entry counts, inventory snapshot (meals ready, active batches, the newest batch with
  per-portion macros for one-tap eating), and the bodyweight mini-trend (last 14 EMA points +
  current + change). Tested against a full seeded day and a fresh account.
  **Feature F11 complete.**

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
