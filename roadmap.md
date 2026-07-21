# BatchFit — Delivery Roadmap

**This is the active roadmap — always use this file, not anything under `agents/completed/`.**
Finished roadmaps are archived there (e.g. the original MVP roadmap, and the Train
grouped-picker/history/1RM/cardio feature). Files in `agents/completed/` are historical
records of finished work — **ignore them unless the user explicitly asks you to look at one.**

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

**Baseline:** the full MVP (see `agents/completed/roadmap.md`) plus the Train exercise-picker
overhaul — grouped picker with recents, exercise history/PBs, estimated + tested 1RM, form-video
links, and combined cardio logging with treadmill speed/incline and a per-session unit toggle
(see `agents/completed/roadmap-train-grouped-picker-history-videos.md`) — are built and merged
to `main`.

**Completed roadmap tasks:** none yet on this roadmap.

**Next up:** awaiting the next feature definition. One standing item carried over from the
Train work: **F15-3** (hand-curating YouTube `videoId`s for the most-used exercises) — content
work, not engineering, do only when ready; see the archived Train roadmap for details.

---

## Working agreement

- **One branch + one PR per task.** Base branch is `main`.
- **Branch naming:** `feat/<area>-<slug>` (e.g. `feat/api-auth-register`, `feat/app-login-screen`).
  Use `chore/`, `fix/`, `docs/` where appropriate.
- **Commits:** small and frequent, present-tense summaries. No need to ask permission to commit.
- **Definition of done for a task:** code compiles (`tsc --noEmit` in the touched project),
  any tests added pass, the PR is opened against `main` with a short description of what to review.
- **Definition of done for a feature:** all its tasks merged, and the "Verification" steps pass.
