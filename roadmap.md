# BatchFit — Delivery Roadmap

**This is the active roadmap — always use this file, not anything under `agents/completed/`.**
The MVP roadmap (Phases 0–12: auth, onboarding, Diary, Prep, Train, Progress, Today) is
complete and archived at `agents/completed/roadmap.md`. Files in `agents/completed/` are
historical records of finished work — **ignore them unless the user explicitly asks you to
look at one.**

A build order for whatever comes next, broken into **Phases → Features → Tasks**.

- **Feature** = a testable milestone. At the end of one, you can exercise it end-to-end
  (via the app, or via the API for backend-only features).
- **Task** = the smallest unit that makes sense to review: **one branch, one PR, small commits.**
- We build **backend-first, then the frontend** for each section, alternating, so every
  slice is testable before the UI depends on it.

Tick tasks off as they merge. `[ ]` = todo, `[x]` = merged.

---

## Current status

_Last updated: 2026-07-21._

**Baseline:** the full MVP (see `agents/completed/roadmap.md`) is built and merged — accounts,
onboarding, Diary, Prep, Train, Progress, Today. Train already has: `Exercise` model
(`muscleGroup`, `equipment`, `trackingMode`, nullable `ownerId` for custom exercises), a flat
searchable `ExercisePicker` with inline create/edit, active-session logging with a numeric
keypad, and repeat-last-workout.

**Completed roadmap tasks:** none yet on this roadmap.

**Next up:** **F13-1** (below) — add the `cardioMachine` field and picker-hierarchy query params
to the Exercise API.

---

## Feature plan: grouped exercise picker, history/PBs, 1RM, form videos

**What's driving this:** picking an exercise mid-workout is currently one flat searchable list.
The ask is a guided **Weights → body part → exercise** / **Cardio → machine → exercise**
browse flow (search still bypasses it instantly), each exercise showing **last time's numbers**
and a **personal best**, an **estimated 1-rep-max** for weight exercises, and a link to a
**form-demo video**. Above all: this must not slow down or clutter logging *during* a workout —
every addition here has to earn its place against "fewer taps, less reading, stays out of the
way."

### Read this first — assumptions & decisions (flag if you want something different)

1. **YouTube legality, answered directly:** linking out to (or embedding via YouTube's own
   official player) a public video is exactly what YouTube is designed for and is standard,
   low-risk practice — that's not the legal risk zone. The real risk zone would be *downloading
   / re-hosting* footage ourselves, which nothing here proposes. The actual open problem is
   **curation and upkeep**, not legality: hand-picking "the" canonical video for ~150 exercises,
   keeping links from rotting when creators delete videos, and quietly endorsing whichever
   channel we pick. Plan below (F15) is a **hybrid**: ship a zero-maintenance YouTube *search*
   link for every exercise now (no legal/curation cost, no schema needed for most rows), with an
   optional `videoId` override column so specific exercises can get a hand-picked exact video
   later without re-architecting anything. We **link out to the YouTube app/browser** rather than
   embedding a player in-app — simplest build, no WebView, no "video disabled for embedding"
   edge cases, and it doesn't cost focus mid-set since watching a form video isn't a mid-set action.
2. **1RM, two possible readings — going with the first:** (a) an **estimated** 1RM computed
   automatically from ordinary working sets (weight × reps, via a standard formula), tracked as
   a rolling personal best — **this is the plan below (F14)** — or (b) a distinct **manual
   "tested max" entry** (an actual all-out single-rep attempt the user logs specifically, kept
   separate from working-set estimates). (a) needs no new UI beyond what's already planned and
   updates itself from data you're logging anyway; (b) is a small, clearly separable add-on
   (one new "Log a 1RM test" action + a place to show it alongside the estimate) if you want a
   true tested max kept distinct from the estimate — say the word and it's a one-task addition
   on top of F14.
3. **"Custom exercise DB table"** — already exists. `Exercise.ownerId` (nullable, FK → `User`)
   already distinguishes shared library exercises (`ownerId: null`) from a user's own
   (`ownerId` set), with working create/edit/delete routes and UI. No new table — the tasks
   below extend the existing model and form instead of duplicating it.
4. **New field needed:** grouping cardio by "machine" (Treadmill / Bike / Rower / Elliptical /
   Stair climber / Outdoor) can't reuse the existing `equipment` field — nearly every cardio
   exercise already has `equipment: "machine"`, so it can't also carry *which* machine. F13 adds
   a second, cardio-only field (`cardioMachine`) for this.

---

### Feature F13 — Grouped exercise picker (browse hierarchy + instant search bypass)

**Goal:** opening "+ Add exercise" defaults to **Weights or Cardio** → (Weights: body part /
Cardio: machine) → exercise list, with **create/edit exercise** at the end exactly as today.
Typing anything in the ever-visible search field at any step **immediately** shows a flat,
name-matched list across the whole library + your own exercises (today's existing behaviour),
skipping the hierarchy entirely. Clearing the search field back to empty returns to the category
root (simplest, least surprising — not "back to wherever you were").

- [ ] **F13-1 (api)** — Schema: add `cardioMachine String?` to `Exercise` in
  `api/prisma/schema.prisma`, migration `add_exercise_cardio_machine`. Document the fixed value
  set in the model comment, same pattern as `muscleGroup`/`equipment`:
  `"treadmill" | "bike" | "rower" | "elliptical" | "stair_climber" | "outdoor" | "other"`.
  Nullable and only ever meaningful when `muscleGroup === "cardio"`.
  - Add a `CARDIO_MACHINES` const array to `api/src/routes/exercises.ts` alongside the existing
    `MUSCLE_GROUPS`/`EQUIPMENT`/`TRACKING_MODES` consts.
  - `validate()`: if `cardioMachine` is provided, it must be one of `CARDIO_MACHINES`; do **not**
    require it (an un-tagged cardio exercise just won't have a machine bucket — falls back to
    "Other" in the UI, see F13-4). Reject a non-null `cardioMachine` when `muscleGroup !==
    "cardio"` (keeps the data clean — it's meaningless outside cardio).
  - `POST /exercises` and `PATCH /exercises/:id`: accept `cardioMachine` in the body under the
    same rule.
  - Endpoint tests: create a cardio exercise with each machine value; reject an invalid machine
    value; reject a non-null machine value on a non-cardio exercise.

- [ ] **F13-2 (api)** — Backfill: extend `api/prisma/seed.ts`'s `LIBRARY_EXERCISES`/cardio rows
  with a `cardioMachine` value per existing seeded cardio exercise (idempotent — this seed script
  already add-misses by name, so re-running fills in the new column for anyone who already
  seeded):
  - Rowing machine → `rower` · Treadmill run → `treadmill` · Outdoor run → `outdoor` ·
    Cycling → `bike` · Assault bike → `bike` · Elliptical → `elliptical` ·
    Stair climber → `stair_climber`.
  - Note this deliberately puts two exercises (Cycling, Assault bike) under one machine bucket
    ("Bike") — proves the grouping is doing real work, not just a 1:1 relabel.
  - Since `seedExercises()` currently only inserts brand-new rows by name (skips existing), add a
    small one-off backfill step: for any existing cardio row with `cardioMachine === null`, set
    it from the same mapping. Safe to run repeatedly (no-op once backfilled).

- [ ] **F13-3 (api)** — `GET /exercises`: accept optional `muscleGroup` and `cardioMachine` query
  params (ANDed with the existing `query` name-filter and the existing owner-visibility filter).
  Used by the hierarchy's body-part and machine list steps to fetch only the exercises in that
  bucket. Endpoint-tested (filter by muscle group alone; by cardio + machine; combined with a
  name query; invalid muscle group returns 400).

- [ ] **F13-4 (app)** — Build the hierarchy step components in `exercise-picker.tsx` (or split
  into `components/exercise-picker/` if the file gets unwieldy — use judgement at implementation
  time, don't split pre-emptively):
  - **Category step** — two large `ChoiceCard`-style buttons, "Weights" and "Cardio" (reuse the
    existing `ChoiceCard` component/visual language from onboarding's goal screen — don't invent
    a new card style).
  - **Body-part step** (Weights only) — chip grid of the 7 non-cardio `MUSCLE_GROUPS`
    (chest/back/legs/shoulders/arms/core/full_body), reusing the existing `ChipGrid` pattern
    already in this file.
  - **Machine step** (Cardio only) — chip grid of `CARDIO_MACHINES`, pretty-labelled (existing
    `prettyLabel` helper), "Other" included as a catch-all bucket for untagged/legacy cardio
    exercises.
  - **Exercise list step** — today's existing row list (`GET /exercises` filtered by the chosen
    muscle group, or cardio + machine), same row layout (name · muscle group/equipment · edit
    pencil for owned exercises), same "+ Create exercise" footer.
  - **Back navigation** — a back chevron in the header at every step except the category root
    (existing header/close-button visual pattern).
  - **Search bypass** — the search field stays visible and focusable at every step (mount it
    once, outside the step content, not re-created per step). The instant the trimmed query is
    non-empty, swap the body to today's flat filtered list (existing debounce timing/behaviour
    unchanged) regardless of which step you were on; clearing it back to empty returns to the
    category root.
  - State: a small local `step` state machine — `{ kind: 'category' } | { kind: 'bodyPart' } |
    { kind: 'machine' } | { kind: 'exercises'; muscleGroup: string; cardioMachine?: string } |
    { kind: 'search' }` — driven by taps and by the query becoming non-empty/empty.

- [ ] **F13-5 (app)** — `ExerciseForm` (create/edit own exercise): show a `cardioMachine` chip
  row (same `ChipGrid` pattern) **only when** the selected muscle group is `"cardio"`; hidden and
  cleared otherwise. Defaults to unset (no machine pre-selected) — pushes the user to pick one
  but doesn't hard-block save if they skip it (matches the non-required validation in F13-1).

**Feature F13 verification:** from a fresh "+ Add exercise", Weights → Legs → shows only leg
exercises; Cardio → Bike → shows Cycling and Assault bike; typing at any step jumps straight to
matching results across everything; creating a custom cardio exercise lets you tag a machine,
creating a custom weights exercise doesn't show the machine row at all.

---

### Feature F14 — Exercise history: "last time" + personal bests + estimated 1RM

**Goal:** the moment an exercise is added to the active session, show what you did last time and
your all-time best, without asking for it — and give every weight/reps set a live estimated
1-rep-max as you type. Read-only, glanceable, never blocks logging if there's no history yet.

- [ ] **F14-1 (api)** — `src/lib/oneRepMax.ts`: pure `estimateOneRepMax(weightKg: number, reps:
  number): number` using the Epley formula (`weight × (1 + reps / 30)`), rounded to 1 decimal.
  `reps <= 1` returns `weightKg` unchanged (no extrapolation off a single rep); guard
  `weightKg <= 0 || reps <= 0` → `0`. Unit-tested (reps=1, reps=0, typical case, e.g. verify
  100kg×5 ≈ 116.7kg).

- [ ] **F14-2 (api)** — `GET /exercises/:id/history` (auth-protected): scoped to the caller's own
  `Workout`s only (join `WorkoutExercise.exerciseId = :id` → `Workout.userId = req.userId`).
  Returns:
  - `last` — the most recent **finished** workout's block for this exercise: `{ date, sets: [...]
    }` (raw set rows in order), or `null` if never logged.
  - `best` — the all-time personal best for this exercise's `trackingMode`, `null` if no sets yet:
    - `weight_reps` → the set with the highest `estimateOneRepMax(weightKg, reps)` across all of
      the user's finished sessions; return `{ weightKg, reps, estimatedOneRepMax, date }`.
    - `bodyweight_reps` → the set with the max `reps`; return `{ reps, date }`.
    - `time` → the set with the max `seconds`; return `{ seconds, date }`.
    - `distance` → the set with the max `distanceM`; return `{ distanceM, seconds, date }`.
  - Only considers sets belonging to **finished** workouts (`finishedAt` not null) — an
    in-progress session's not-yet-committed numbers shouldn't count as your new PB while you're
    mid-set.
  - 404 if the exercise doesn't exist or isn't visible to the caller (not the library and not
    theirs) — same visibility rule as `GET /exercises`.
  - Endpoint-tested: no history → both null; one past session → `last` matches it; two past
    sessions with a bigger lift in the older one → `best` still finds the max, not just the most
    recent; an in-progress (unfinished) session's sets are excluded from both.

- [ ] **F14-3 (app)** — On adding an exercise to the active session (`addExercise` in
  `workout/[id].tsx`), fetch `GET /exercises/:id/history` once and cache it in the block's local
  state for the session's lifetime (no re-fetch on every render/set-add). Render a compact one-
  or-two-line strip under the exercise block header:
  - `weight_reps`: `"Last: 3×8 @ 60kg · 12 Jun   Best: 72.5kg e1RM (5×65kg) · 3 Jun"`
  - `bodyweight_reps`: `"Last: 3×12 · 12 Jun   Best: 18 reps · 3 Jun"`
  - `time`: `"Last: 3×45s · 12 Jun   Best: 90s · 3 Jun"`
  - `distance`: `"Last: 5.0km · 12 Jun   Best: 8.2km · 3 Jun"`
  - Nothing to show (first time doing this exercise) → **render nothing**, not an empty state —
    this is a glance-and-go strip, not a data screen; don't spend a state on "no history yet."
  - Loading: render nothing until it resolves rather than a spinner — the strip should just pop
    in a moment after the block appears, no layout jank from a placeholder.

- [ ] **F14-4 (app)** — Per-set live estimated 1RM for `weight_reps` blocks only: as soon as a set
  row has both a weight and a rep count entered, show a small muted `"≈ e1RM 72.5kg"` next to
  that set, computed client-side with the same Epley formula (mirror `oneRepMax.ts`'s logic
  inline or extract a tiny shared constant/helper — don't duplicate the formula's magic number
  in two places without a comment tying them together). Purely derived from what's already
  typed — no network round-trip, updates instantly on every keystroke.

**Feature F14 verification:** add an exercise you've logged before → last-time and best strip
appears within a beat; add one you've never logged → no strip, no flash of empty state; type a
weight+reps into a set → e1RM appears immediately and updates as you adjust either number;
finish two sessions with a bigger lift in the first → best still reflects the first, not just
most-recent.

---

### Feature F15 — Exercise form-demo video link

**Goal:** a way to watch a demonstration of the movement, without building any video
infrastructure or taking on curation debt to ship it.

- [ ] **F15-1 (api)** — Add two nullable columns to `Exercise`: `videoId String?` (a specific
  YouTube video ID, hand-picked) and `videoQuery String?` (a custom search phrase override,
  rarely needed). Neither is required — when both are null, the app computes a sensible default
  search phrase itself (see F15-2), so this ships with **zero data entry**. Migration
  `add_exercise_video_fields`. Accept both (optional) in `POST`/`PATCH /exercises` for parity with
  custom exercises, though the create/edit UI won't expose them yet (F15-3 is the curation pass —
  no UI needed for a field almost nothing will set for a while).

- [ ] **F15-2 (app)** — "Watch form video" row (small icon + label, e.g. a YouTube glyph) on the
  exercise block header in the active session. On tap:
  - If `videoId` is set → `Linking.openURL('https://www.youtube.com/watch?v=' + videoId)`.
  - Else → `Linking.openURL('https://www.youtube.com/results?search_query=' + encodeURIComponent((videoQuery ?? name) + ' exercise form'))`.
  - Opens in the YouTube app if installed, else the browser (`Linking.openURL` does this for free
    on both platforms — no extra plumbing). No in-app WebView/embed for this feature.

- [ ] **F15-3 (content, not code — do only when ready)** — Hand-pick `videoId` values for the
  ~30–50 most commonly logged library exercises, set via a small one-off script or direct DB
  edit. This is curation/vetting work (picking a channel you're comfortable pointing users at,
  confirming the video allows embedding-adjacent linking, isn't age-restricted, etc.) — flagged
  explicitly so it's never mistaken for a blocking engineering task.

**Feature F15 verification:** tapping "Watch form video" on an untagged exercise opens a YouTube
search for its name; on one with a curated `videoId` it opens that exact video.

---

## Proposed enhancements (not yet scheduled — pick any to add as new Features)

Brainstormed while planning the above, aimed squarely at the "must be usable without breaking
focus, one-handed, mid-set, in a gym" constraint. Not built, not estimated in detail — flag which
(if any) you want turned into real Features/Tasks next:

- **Rest timer** — auto-starts a countdown the moment a set is marked done; big numerals, +30s /
  skip; the single highest-value addition for staying heads-down between sets instead of
  eyeballing a phone clock.
- **Warm-up set flag** — a per-set toggle (`isWarmup` on `WorkoutSet`) excluded from the F14
  best/PB calculation, so a light warm-up rep doesn't quietly overwrite a real personal best.
- **Favourites / recent exercises row** — a "Recent" strip above the F13 category chooser
  (mirrors Diary's existing `GET /foods/recent` pattern) so your usual 5–10 exercises need zero
  taps through the hierarchy at all.
- **Plate calculator** — given a target weight + bar type, show plates-per-side; removes mental
  math mid-set for barbell `weight_reps` exercises.
- **Optional RPE per set** — already flagged as a hook in `mvp-spec.md` (5.2) and never built;
  small addition once F13/F14 land.
- **Haptic tap on set-complete / new-PB** — a felt confirmation instead of a read confirmation,
  so eyes never have to leave the bar.

---

## Working agreement

- **One branch + one PR per task.** Base branch is `main`.
- **Branch naming:** `feat/<area>-<slug>` (e.g. `feat/api-auth-register`, `feat/app-login-screen`).
  Use `chore/`, `fix/`, `docs/` where appropriate.
- **Commits:** small and frequent, present-tense summaries. No need to ask permission to commit.
- **Definition of done for a task:** code compiles (`tsc --noEmit` in the touched project),
  any tests added pass, the PR is opened against `main` with a short description of what to review.
- **Definition of done for a feature:** all its tasks merged, and the "Verification" steps pass.
