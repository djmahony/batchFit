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

## Repository status: pre-build

There is **no application code, build system, package manager, or test suite in this repo yet.** It currently contains only planning and design artifacts. Do not assume any tooling exists — if asked to "build", "test", or "run", there is nothing to run until the app is scaffolded. When scaffolding begins, the intended stack is a **React Native / Expo** app (phone-first, portrait-only, iOS + Android) that is **fully offline / local-first** for the MVP (no network, accounts, or sync — those are Phase 3).

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
- `batchFitDesignWork/*.dc.html` — exported visual design mockups (Onboarding, Today, Diary, Prep, Train, Brand, Wireframes). These are generated design-tool exports, not app source — treat as reference, not code to edit.

## App structure the spec defines (for when code is written)

Five-tab bottom navigation is the backbone: **Today** (daily dashboard), **Diary** (food log), **Prep** (⭐ the batch/recipe/inventory differentiator — give it the most care, visually central), **Train** (workout logging), **Progress** (bodyweight trend + settings gateway).

Product framing is **Plan it · Batch it · Burn it**. Note the deliberate balance: **food/macro logging (Diary) and workout logging (Train) are co-equal first-class pillars** — the batch-cooking *mechanic* is the unique differentiator, but Train is not a secondary feature and must get equally polished, fast logging flows.

Reusable components the spec expects to be built once and shared: Macro Ring/Bar set, Date selector, Food search field + results, Quantity/portion control, numeric keypad, empty-state pattern. Every data screen must handle four states: **empty / loading / populated / error**.

## Phase-2/3 hooks to leave room for (design, don't build in MVP)

Barcode scanning (slot in food search), calorie-burn estimation feeding back into the daily budget (slot on Today), adaptive targets, and account/cloud-sync (row in Settings). Leave visual/architectural room; do not implement.

## Voice for any UI copy

Plain, warm, direct, lightly witty — a competent ally, never shaming or hype ("Three prepped meals left — time for a cook-up?"). Never surface diet-shame language ("you've exceeded your limit"). Empty states and the prep-success moment are where the brand personality should show. No ads, no data-selling — this is a market positioning point, not just a policy.
