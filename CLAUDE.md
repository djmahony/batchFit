# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.
2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Working from the roadmap

`roadmap.md` is the single source of truth for what to build, in what order, and how far we've
got. It is a living document — **Phases → Features → Tasks** — with a **Current status** section
at the top (baseline, completed tasks, what's next). When prose elsewhere (including this file)
disagrees with `roadmap.md`'s Current status about what exists, **trust `roadmap.md`.**

### When the user says "continue" (or similar)

1. Read `roadmap.md`; go to **Current status → Next up** and find the first unchecked `[ ]`
   task in that order.
2. Get onto an up-to-date `main`: `git checkout main && git pull --ff-only`.
3. Do that one task following the workflow below. If which task is next is genuinely ambiguous,
   ask; otherwise proceed without waiting for further permission.

### Task workflow — one task = one branch = one PR

- **Branch** off `main`: `feat/<area>-<slug>` (area = `api` or `app`), or `chore/` / `fix/` /
  `docs/`.
- **Commit in small chunks as you go** — no need to ask permission to commit.
- On the same branch, **update `roadmap.md`**: tick the task `[x]` and advance **Current status**
  (Completed / Next up) so the doc always reflects reality.
- **Push** the branch and **open a PR into `main`** (`gh pr create`). The user reviews and
  merges — do not merge it yourself.
- **Never commit feature work directly to `main`.**

### Definition of done (per task)

The touched project typechecks (`tsc --noEmit`), any added tests pass, `roadmap.md` is updated,
and the PR is open against `main`. Because status lives in `roadmap.md`, a fresh session can read
it and resume exactly where the last one stopped.

## Architecture & repository status

This repo is a **monorepo** being built against `roadmap.md` (the source of truth for status —
see its **Current status** section for exactly what exists):
- `app/` — the client: a **React Native / Expo** app, phone-first, portrait-only, iOS + Android.
- `api/` — the server: **Express + TypeScript + Prisma**, with a Vitest + Supertest test harness.

**BatchFit is built as a client–server app with user accounts from day one.** The app depends on
the API and requires login before use; register/login and API-backed onboarding come first
(Phase 1). This is a **deliberate departure** from the older framing in this file and in
`mvp-spec.md`, which described a **fully offline, single-user, local-first** MVP with accounts
deferred to Phase 3. Where those docs still say "offline / no network / accounts later," **trust
`roadmap.md`.** Only **cloud sync** (multi-device, media) remains a later-phase item — accounts
and the API are not.

## What the product is

BatchFit is a weight-loss / body-composition tracker whose differentiator is that the **batch cook is the core unit**, not the individual meal. The mechanic that everything else is built around:

> Log a cook once → the app totals macros across all ingredients → split into N portions → per-portion macros are computed → the batch enters an **inventory** → "eat one" logs a portion to the day *and decrements the remaining count*.

Two data concepts must stay clearly distinct in any model or UI:
- **Recipe** = a reusable template (ingredient list + default portion count). Lives in the Recipes list.
- **Batch** = one actual cook, which *snapshots the real amounts used* (cooking varies cook-to-cook). Lives in **Inventory** with a portions-remaining count.

Editing a batch after portions have been logged must **not** rewrite already-logged history — only future portions reflect edits (MVP rule).

Five tracked nutrients everywhere: **Calories, Protein, Fat, Carbs, Fibre.** Hierarchy is fixed across every screen: **Calories is the hero metric; Protein is the prioritised macro.**

## Source-of-truth documents

Read these before designing data models, screens, or copy — they are the spec:
- `business.md` — brand, tone of voice, audience, positioning, visual direction, roadmap phases. Read for *look-and-feel and voice*. (`batchFitDesignWork/uploads/business.md` is an identical copy.)
- `batchFitDesignWork/uploads/mvp-spec.md` — the authoritative **screen-by-screen MVP specification**: navigation, every screen's sections/states, and cross-screen rules. Read for *structure and behaviour*.
- `batchFitDesignWork/*.dc.html` — exported visual design mockups (Onboarding, Today, Diary, Prep, Brand, Wireframes). These are generated design-tool exports, not app source — treat as reference, not code to edit.

## Match the designs — mandatory before building or styling any screen

**Any time you build a new screen, component, or change styling, you MUST first open the
relevant mockup in `batchFitDesignWork/` and make the implementation match it.** Do not style
from the theme tokens alone or invent a look — the mockups are the visual spec. This is part of
the definition of done for any frontend task: the screen should visually match its mockup
(layout, colour, type scale, spacing, component shapes, empty/loading/error states), not just
"use the app's colours."

Workflow for a UI task:
1. **Read the matching mockup(s)** before writing UI. They're HTML/CSS exports, so open them and
   pull the real values (colours, font sizes/weights, radii, spacing, gradients, imagery). Screen
   → file mapping:
   - Auth (Welcome / Register / Login) & onboarding → `BatchFit Onboarding.dc.html`
   - Today → `BatchFit Today.dc.html` · Diary → `BatchFit Diary.dc.html` · Prep →
     `BatchFit Prep.dc.html`
   - Shared visual language (palette, typography, buttons, logo usage) → `BatchFit Brand.dc.html`
     and `BatchFit Logo.svg`
   - Overall layout/flow when a dedicated screen file doesn't exist → `BatchFit Wireframes.dc.html`
2. **Reconcile the design with the shared tokens** in `app/src/constants/theme.ts`: if the mockup
   introduces values not yet in the theme, add them to the theme and use them — don't hard-code
   one-off colours in a screen.
3. **If the mockup and the code conflict, or a screen has no mockup, ask** rather than guessing.

## App structure the spec defines (for when code is written)

Five-tab bottom navigation is the backbone: **Today** (daily dashboard), **Diary** (food log), **Prep** (⭐ the batch/recipe/inventory differentiator — give it the most care, visually central), **Train** (workout logging), **Progress** (bodyweight trend + settings gateway).

Product framing is **Plan it · Batch it · Burn it**. Note the deliberate balance: **food/macro logging (Diary) and workout logging (Train) are co-equal first-class pillars** — the batch-cooking *mechanic* is the unique differentiator, but Train is not a secondary feature and must get equally polished, fast logging flows.

Reusable components the spec expects to be built once and shared: Macro Ring/Bar set, Date selector, Food search field + results, Quantity/portion control, numeric keypad, empty-state pattern. Every data screen must handle four states: **empty / loading / populated / error**.

## Phase-2/3 hooks to leave room for (design, don't build in MVP)

Barcode scanning (slot in food search), calorie-burn estimation feeding back into the daily budget (slot on Today), adaptive targets, and **cloud sync** (multi-device / media — the Settings row). Leave visual/architectural room; do not implement. (Note: **accounts themselves are Phase 1**, not a deferred hook — only cross-device *sync* is later.)

## Voice for any UI copy

Plain, warm, direct, lightly witty — a competent ally, never shaming or hype ("Three prepped meals left — time for a cook-up?"). Never surface diet-shame language ("you've exceeded your limit"). Empty states and the prep-success moment are where the brand personality should show. No ads, no data-selling — this is a market positioning point, not just a policy.
