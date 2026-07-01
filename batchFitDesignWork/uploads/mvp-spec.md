# BatchFit — MVP Screen Specification

> **Purpose of this document:** A precise, screen-by-screen specification of the Phase 1 (MVP) app, written to brief a designer producing wireframes and high-fidelity designs. Every screen lists its purpose, how the user arrives, each section/component it contains, the data shown, the interactions available, and the states the designer must account for (empty / loading / error / populated).
> **Scope:** Phase 1 MVP only — fully usable, offline, single user. Barcode scanning, cloud sync, accounts, and adaptive targets are **out of scope** here (Phases 2–3) and are flagged where a hook should be left in the design.
> **Platform:** This is a **native mobile app for iOS and Android** (built with React Native / Expo), designed **phone-first and portrait-only**. Every wireframe should assume a one-handed, thumb-driven experience on a phone screen — **not** tablet or desktop. Use standard mobile conventions throughout: a bottom tab bar, full-screen pushes, bottom-sheet modals, and native-style numeric keypad / date pickers.
> **Product pillars — _Plan it · Batch it · Burn it_:** the app has **two equally important logging cores — nutrition (macros) and exercise** — framed by the tagline. *Plan it* = set your targets and plan what you'll eat and cook. *Batch it* = batch-cook and log your food/macros (calories, protein, fat, carbs, fibre). *Burn it* = log your workouts and burn it off. **Macro logging and workout logging are both key — neither is an afterthought.** (Only the *batch-cooking* mechanic is the unique differentiator; the food and exercise logs are both core, polished pillars. A fuller forward meal-_planner_ is a later phase — in the MVP, *Plan it* is expressed through targets and the prep/cook workflow.)
> **Companion doc:** `business.md` (brand, tone, audience, visual direction). Read that first for look-and-feel; this doc defines structure and behaviour.

---

## 0. Global Foundations

### 0.1 Navigation model
A **persistent bottom tab bar** with five tabs is the primary navigation. This is the app's backbone — the designer should treat it as always visible except during onboarding and full-screen modal flows.

| # | Tab | Icon concept | Role |
|---|-----|-------------|------|
| 1 | **Today** | Ring / sun | Daily home: targets vs. intake, quick actions |
| 2 | **Diary** | Book / list | The full food log for any given day |
| 3 | **Prep** | Stockpot / portioned container | **The differentiator** — batch cooking, recipes, meal inventory |
| 4 | **Train** | Dumbbell / bar | Workout logging and history |
| 5 | **Progress** | Trend line | Bodyweight trend, stats, and access to settings |

> **Design priority:** The **Prep** tab is the product's signature *differentiator* and should feel like the most distinctive part of the app — ideally sit visually central (middle tab) with a slightly emphasised treatment. **But note:** the tagline's two logging cores — **Diary (food/macros = _Batch it_)** and **Train (exercise = _Burn it_)** — are **both first-class pillars** and deserve equally fast, polished logging flows. The differentiator is the *batch-cooking mechanic*, not "nutrition over exercise." Design the food log and the workout log with the same level of care.

### 0.2 Recurring patterns (define once, reuse everywhere)
The designer should design these shared components a single time; they appear across many screens:

- **Macro Ring / Bar set** — the visual representation of 5 nutrients: **Calories, Protein, Fat, Carbs, Fibre.** Used on Today, Diary, Batch detail, Food detail. Needs a "remaining vs. target" mode and a "total only" mode. Calories is the hero; the four macros are secondary. Protein should be visually prioritised among macros (it's the metric weight-loss users care about most).
- **Date selector** — a horizontal day strip or `< Date >` header used on Today, Diary, and Train to move between days. Default = today.
- **Food search field + results list** — used in food logging, batch ingredient entry, and recipe building. One component, reused.
- **Quantity / portion entry control** — numeric entry with unit toggle (g / serving / portion). Reused anywhere a food amount is set.
- **Numeric keypad entry** — for weights, reps, and macro values; large, thumb-friendly, fast.
- **Empty state** — friendly illustration + one-line explanation + primary action button. Every list screen needs one.
- **Primary action button (FAB or bottom bar)** — the "add" action, consistent placement per tab.

### 0.3 Global states the designer must provide for every data screen
- **Empty** (no data yet — first run): encouraging, instructive, points to the primary action.
- **Loading**: brief; mostly local DB so near-instant, but design a lightweight skeleton/placeholder.
- **Populated**: the normal state.
- **Error / edge**: e.g. food not found, a batch with 0 portions left, an unfinished workout. Specified per screen below.

---

## 1. Onboarding (first launch only)

**Purpose:** Get a brand-new user from install to a personalised, ready-to-use app in under a minute, and capture the minimum needed to set calorie/macro targets. This is the user's first brand impression — it must feel fast, warm, and competent.

**Entry point:** Automatically on first launch; never shown again once completed (re-runnable from Settings).

**Screens / steps:**

1. **Welcome**
   - Sections: Logo + tagline ("Plan it. Batch it. Burn it."); a one-sentence promise centred on the batch-cooking hook ("Cook once, eat all week, macros sorted."); single "Get started" button; subtle "skip setup" affordance.
   - Purpose: set tone, communicate the differentiator immediately.

2. **Your goal**
   - Sections: choice of goal — **Lose weight / Maintain / Build muscle** (large tappable cards). Optional rate selector for weight loss (e.g. gentle / moderate / aggressive, expressed as kg or lb per week).
   - Purpose: frames everything downstream.

3. **About you (for target calculation)**
   - Sections: inputs for sex, age, height, current weight, activity level (sedentary → very active, as selectable cards with plain-language descriptions). Unit toggle (metric/imperial) prominent here.
   - Purpose: feeds the TDEE calculation.

4. **Your targets (calculated)**
   - Sections: the calculated **daily calorie target** as the hero number; the macro split (protein / fat / carbs, with fibre target) shown as the Macro Ring set; a plain-language explanation ("Based on your goal, here's your daily target"); ability to **manually override** any value; "Looks good" confirm button.
   - Purpose: deliver the personalised payoff and let confident users tweak.
   - **Edge/empty:** if the user skipped "About you," present sensible default targets with a clear "edit later in Settings" note.

5. **Ready** (optional micro-screen)
   - Sections: brief orientation pointing at the three core actions — log food, prep a batch, start a workout. One "Start" button into the Today tab.

**States:** linear flow with back navigation; progress indicator (e.g. step dots). All inputs must validate gently (no hard error walls — guide, don't block).

---

## 2. Today (Tab 1 — Dashboard / Home)

**Purpose:** The daily command centre. At a glance the user sees how much of their calorie/macro budget remains for *today*, what they've eaten, what prepped meals are available to eat, and one-tap routes to every logging action. This is the screen opened most often; it must answer "where am I today and what do I do next?" instantly.

**Entry point:** Default tab on app open; landing screen after onboarding.

**Sections (top to bottom):**

1. **Header / date**
   - Today's date with the **Date selector** to move to past/future days. Optional friendly greeting.

2. **Daily budget summary (hero)**
   - The **Macro Ring set** showing **Calories remaining** (hero) plus Protein / Fat / Carbs / Fibre as consumed-vs-target.
   - Tappable to expand into a small breakdown (consumed / target / remaining numbers).
   - Purpose: the single most important glance in the app.

3. **Quick actions row**
   - Prominent buttons: **Log food**, **Eat a prepped meal**, **Start workout**, **Log weight.**
   - "Eat a prepped meal" is intentionally first-class here — it routes into the inventory picker and is the fastest path to logging for a prepper.

4. **Today's meals summary**
   - Compact list of meal groups (Breakfast / Lunch / Dinner / Snacks) with each meal's calorie subtotal; tapping a meal jumps to the Diary at that meal.
   - **Empty state:** "Nothing logged yet — log your first meal" with a primary action.

5. **Inventory snapshot**
   - A small card: "**X prepped meals ready**" with a 1-tap "Eat one" / "View inventory" route into the Prep tab.
   - Purpose: keep the batch-cooking value visible on the home screen; nudge restocking when low ("Running low — time for a cook-up?").
   - **Empty state:** "No prepped meals yet — prep your first batch."

6. **Bodyweight mini-trend**
   - A small sparkline of recent weight with the latest value and a "Log weight" affordance.
   - **Empty state:** "Add your weight to start tracking your trend."

**Interactions:** every card is a shortcut into its detailed area. Pull-to-refresh optional (local data). Changing the date re-scopes the whole screen to that day (read-only sense of history; logging defaults to today).

**States:** First-run shows a friendly, mostly-empty dashboard that visibly guides the user toward the three core actions.

---

## 3. Diary (Tab 2 — Food Log)

**Purpose:** The complete, editable record of what the user ate on a given day, organised by meal, with running totals against targets. Where Today summarises, the Diary is the full ledger and the primary place to add, edit, and review food.

**Entry point:** Diary tab; also reached by tapping a meal on Today.

**Sections:**

1. **Date header** — Date selector; defaults to today. Swiping left/right between days is desirable.

2. **Daily totals bar** — a condensed **Macro Ring/Bar set** pinned at the top showing consumed vs. target for all five nutrients, so it stays visible while scrolling the log.

3. **Meal groups** (Breakfast / Lunch / Dinner / Snacks — labels should be user-renameable in Phase 2; fixed in MVP)
   - Each group is a section header with the meal's calorie subtotal and an inline **"+ Add food"** action.
   - Under each header: the list of logged items. Each row shows: food name, quantity/portion, and calories (with macros available on tap/expand).
   - **Prepped-meal items are visually distinguished** (e.g. a small batch/pot tag) so the user can see at a glance which entries came from their inventory.

4. **Row actions** — tap a logged item to edit quantity or delete it; swipe-to-delete as a fast path.

5. **Add-food entry point** — both per-meal "+ Add food" and a global primary "Add" action. Choosing it opens the **Add Food flow** (Section 3.1).

**Empty state:** each meal group shows a light "Nothing here yet" with an add prompt; whole-day empty state encourages the first log.

### 3.1 Add Food flow (modal / pushed screens)
**Purpose:** Find or create a food and log a specific amount to a chosen meal and day.

**Steps / sections:**
- **Search & sources tabs:** a search field plus quick tabs for **Recents**, **Favourites**, **My foods (custom)**, and **My recipes/batches**. (Recents/Favourites are the fastest path and should be prominent — most users eat the same foods repeatedly.)
   - *Phase-2 hook:* leave space in this header for a **barcode-scan** button (not functional in MVP, but the layout should anticipate it).
- **Results list:** each result shows name, brand (if any), and calories per default serving; tap to proceed.
- **Food detail / quantity screen:** food name; **quantity/portion control** (g, serving, or portion) with unit toggle; live-updating **Macro Ring set** reflecting the chosen amount; meal selector (which meal it goes to); date (defaults to current diary day); "Add" confirm.
   - **Edge:** food missing some macro data — show what's known, mark unknowns clearly rather than as zero.
- **"Create custom food" path:** a form — name, serving size/unit, and per-serving Calories / Protein / Fat / Carbs / Fibre. Saves into "My foods" for reuse. Reachable when search returns nothing.
   - **Empty/no-result state:** "No match — create it as a custom food" with a direct button.

---

## 4. Prep (Tab 3 — Batch Cooking, Recipes & Inventory) ⭐

> **This is the signature area of the app and should receive the most design care.** It must make the batch → portion → inventory workflow feel effortless and even satisfying. Everything here maps to the core differentiator described in `business.md`.

**Purpose:** Let the user record a bulk cook once, compute macros per portion automatically, and maintain a live inventory of how many prepped meals they have left — eating from stock with a single tap.

**Entry point:** Prep tab; also reached from Today's "Eat a prepped meal" and inventory snapshot.

This tab has **two views (a segmented control or sub-tabs at the top):** **Inventory** (default) and **Recipes.** Plus the **Create/Edit Batch flow** and detail screens.

### 4.1 Inventory (default view)
**Purpose:** Show all currently-stocked prepped batches and how many portions remain, so the user always knows what's in the fridge.

**Sections:**
1. **Header** — "Inventory" title; a summary stat ("**12 meals prepped · ~4 days stocked**"); a prominent **"+ New batch"** primary action.
2. **Active batch cards** — one card per batch with portions remaining > 0. Each card shows:
   - Batch name (e.g. "Chicken & Rice")
   - **Portions remaining** as the hero element (e.g. "**6 left**" of 8)
   - **Macros per portion** (compact: kcal + protein at minimum, full set on tap)
   - Cooked date / freshness hint (e.g. "Cooked 2 days ago")
   - A one-tap **"Eat one"** action that logs a portion to today and decrements the count.
3. **Low-stock emphasis** — batches at 1–2 portions visually flagged to prompt a re-cook.
4. **Depleted/empty handling** — when a batch hits 0, it leaves the active inventory and moves to history (accessible but not cluttering the main list).

**Interactions:** tap a card → **Batch Detail** (4.2). "Eat one" is the fast path. "+ New batch" → **Create Batch flow** (4.3).

**Empty state:** the most important empty state in the app — a warm, instructive screen explaining the batch-cooking concept in one or two lines and a big "Prep your first batch" button.

### 4.2 Batch Detail
**Purpose:** Full view of a single cooked batch — its composition, per-portion macros, and remaining stock — and the place to eat from it or adjust it.

**Sections:**
1. **Header** — batch name, cooked date, and **portions remaining / total** (e.g. "6 of 8 left").
2. **Per-portion macros** — the full **Macro Ring/Bar set** for *one portion* (the headline value of the whole feature).
3. **Whole-batch totals** — secondary display of the totals across the entire cook.
4. **Ingredients list** — each ingredient with the amount used in *this cook* (e.g. "Chicken breast — 1.2 kg", "Cornflour — 250 g") and its macro contribution. This is the snapshot of the actual cook.
5. **Primary action — "Eat a portion"** — logs one portion to a chosen meal/day and decrements remaining.
6. **Secondary actions** — adjust portions remaining (e.g. you ate two on the go / threw one out), edit the batch, duplicate as a new cook, delete.

**Edge cases:** 0 portions remaining → the "Eat a portion" action disables and the screen offers "Cook this again" (pre-fills a new batch from the same recipe). Editing a batch after some portions are eaten must recompute per-portion values sensibly and warn if it changes already-logged history (MVP: keep logged entries as-is; only future portions reflect edits).

### 4.3 Create / Edit Batch flow (the core flow — design with extra care)
**Purpose:** Record a cook and produce per-portion macros + a new inventory item. Must be fast and feel rewarding at the end.

**Steps / sections:**
1. **Start point** — choose **"New batch from scratch"** or **"From a saved recipe"** (pre-fills ingredients and default portions). Name the batch.
2. **Add ingredients** — reuses the **Food search field + results**; for each ingredient the user sets an **amount by weight** (g/kg primarily) via the quantity control. The list builds up with each ingredient's running macro contribution visible.
   - **Edge:** ingredient not in database → inline "create custom food" path (same as 3.1).
3. **Set number of portions** — a clear numeric control ("Split into how many meals?"). As this changes, the **per-portion macros update live** — this is the magic moment and should be visually celebrated.
4. **Review** — a summary screen: whole-batch totals, **per-portion macros (hero)**, ingredient list, portion count. Confirm with **"Add to inventory."**
   - Optionally offer **"Save as recipe"** so this becomes a reusable template.
5. **Confirmation** — brief success state ("8 meals prepped 🎉") returning to Inventory with the new batch on top.

**States:** the flow must be resumable/editable step to step; live macro feedback throughout; sensible validation (can't save a batch with no ingredients or 0 portions).

### 4.4 Recipes (sub-view) & Recipe Detail/Edit
**Purpose:** Reusable templates of ingredient lists + default portion counts, so repeat cooks are one tap to start.

**Sections:**
- **Recipes list** — cards with recipe name, default portions, and per-portion macros (based on default amounts). "+ New recipe" action.
- **Recipe detail/edit** — name, ingredient list with default amounts, default portion count, computed per-portion macros, and a primary **"Cook this"** action that launches the Create Batch flow pre-filled (where the user can tweak actual amounts for this specific cook before saving to inventory).
- **Empty state:** "Save your go-to preps as recipes for one-tap cooking."

> **Key conceptual distinction the design must make legible:** a **Recipe** = reusable template; a **Batch** = one actual cook (with its own snapshotted amounts) that lives in **Inventory**. The UI language and visual treatment should keep these clearly separate so users never confuse "what I can make" with "what I have ready."

---

## 5. Train (Tab 4 — Workout Logging)

**Purpose:** Log strength and other workouts — exercises with sets/reps/weight — and review workout history. This is the **"Burn it"** pillar of the tagline and a **co-equal core of the app alongside food/macro logging** — not a secondary feature. The calories you *burn* and the calories you *eat* are two halves of the same weight-loss goal, so workout logging must be as fast, polished, and prominent as the food log. It serves both the general weight-loss user (burning off their preps) and the dedicated lifter in the audience.

> **"Burn it" design note / Phase-2 hook:** Whether logged exercise should *estimate calories burned* and feed back into the day's calorie budget on Today (i.e. "you can eat back some of what you burned") is a key product decision. **MVP:** log the workout itself (exercises, sets, reps, weight, duration); calorie-burn estimation and adding it back to the daily budget is a **Phase-2 enhancement** — but leave visual room on Today for an "exercise / burned" figure so it can slot in later.

**Entry point:** Train tab; also "Start workout" from Today.

### 5.1 Train home / history
**Sections:**
1. **Header** — title; prominent **"Start workout"** primary action.
2. **Active/unfinished workout banner** — if a session is in progress, a persistent banner to resume it.
3. **History list** — past sessions, each showing date, workout name/duration, and a summary (exercises, total sets or volume). Tap → read-only session summary.
4. **Empty state:** "Log your first workout."

### 5.2 Active Workout Session
**Purpose:** The live screen used *during* a workout to add exercises and record sets quickly with minimal taps.

**Sections:**
1. **Session header** — workout name (editable), elapsed time/date, and "Finish" action.
2. **Exercise blocks** — each added exercise is a block containing:
   - Exercise name
   - A **set table**: rows of **Set # · Weight · Reps** (plus optional RPE/notes). Support alternate modes per exercise: weight×reps, bodyweight reps, time-based, distance/duration.
   - **"+ Add set"** (should pre-fill from the previous set to minimise typing), and a **"repeat last time"** convenience that pulls the previous session's numbers for that exercise.
3. **"+ Add exercise"** — opens the **Exercise picker** (search the library or create new).
4. **Finish** — saves the session to history; returns a brief summary.

**Interactions:** the **numeric keypad** entry must be fast and stay out of the way; editing/deleting a set inline; reordering exercises is a nice-to-have.

**Edge cases:** abandoning a session (leave it as "unfinished" and resumable); an exercise with no completed sets.

### 5.3 Exercise Library / Picker & Exercise Detail
**Purpose:** Manage the catalogue of exercises the user can log.

**Sections:**
- **Exercise list/picker** — searchable list; each item shows name and muscle group/equipment. Used both for browsing and for adding to a session. "+ Create exercise" action.
- **Create/edit exercise** — form: name, muscle group, equipment type, and default tracking mode (weight×reps / bodyweight / time / distance).
- **Exercise detail (optional in MVP)** — basic history of that exercise's best/most-recent sets (a small personal-record/last-time view); can be minimal in MVP.
- **Empty state:** seed with a starter set of common exercises so the library isn't empty on first use, plus the create path.

---

## 6. Progress (Tab 5 — Bodyweight, Trends & Stats)

**Purpose:** Show the user their trajectory over time — primarily bodyweight trend — to reinforce that the daily logging is paying off. Also the home for stats and the gateway to Settings.

**Entry point:** Progress tab; "Log weight" from Today.

**Sections:**

1. **Bodyweight trend (hero)**
   - A line chart of bodyweight over time. **Raw daily entries shown as light points, with a smoothed trend line as the emphasised series** (daily weight is noisy; the trend is the real signal — this must be visually clear).
   - Range toggle (e.g. 1M / 3M / 6M / All).
   - Current weight, change over the selected range, and progress toward goal weight (if set).
   - **"Log weight"** action.
   - **Empty state:** "Log your weight to see your trend."

2. **Add weight entry (modal)** — date (defaults today), weight value with unit, optional note. Editable/deletable entries.

3. **Secondary stats (lightweight in MVP)** — e.g. average daily calories over the last week, current inventory count, workouts logged this week. Kept simple; expandable in later phases.

4. **Access to Settings** — a clear entry point (gear icon or list row) into Section 7.

---

## 7. Settings / Profile

**Purpose:** Let the user adjust the things established in onboarding and basic app preferences. Not heavily trafficked but essential.

**Sections:**
1. **Goals & targets** — edit goal (lose/maintain/build), re-run the **TDEE target calculator**, or manually set calorie + macro targets (Calories / Protein / Fat / Carbs / Fibre). Changing targets updates all the rings app-wide.
2. **Profile** — sex, age, height, current/goal weight.
3. **Preferences** — units (metric/imperial), and (placeholder) meal-group labels.
4. **Data** — basic local-data management (export/clear). *Phase-3 hook:* this is where "Account & cloud sync" will later live — leave room for it.
5. **About** — app version, brand info.

### 7.1 TDEE Target Calculator (reused screen)
**Purpose:** Compute recommended calories/macros from profile + goal. Same component used in onboarding step 4 and from Settings. Inputs: profile + activity + goal/rate. Output: recommended targets with manual override and a plain-language explanation of how it was derived.

---

## 8. Cross-Screen Behaviours & Notes for the Designer

- **"Eat a prepped meal" is the hero logging action** and appears in multiple places (Today quick actions, inventory snapshot, Diary add-food → "My recipes/batches", Batch detail). Keep its visual identity consistent everywhere so users learn it as *the* fast path.
- **Calories is always the hero metric; Protein is the prioritised macro.** Maintain this hierarchy in every Macro Ring/Bar instance.
- **Today vs. history:** moving the date back is for *reviewing*; new logging defaults to today. Make "you're viewing a past day" visually obvious to avoid accidental back-dated logging.
- **Phase-2 hooks to leave room for (design, don't build):** barcode-scan button in food search; a slot for adaptive-target messaging on Today; account/sync row in Settings.
- **Offline-first:** there is no network dependency in MVP — avoid any UI that implies "syncing"/"uploading." Everything is instant and local.
- **Tone in UI copy:** follow `business.md` — plain, warm, encouraging, lightly witty; never shaming. Empty states and the prep-success moment are the best places to express brand personality.

---

## 9. Screen Inventory (quick checklist for wireframing)

**Onboarding:** Welcome · Goal · About you · Targets · Ready
**Today:** Dashboard
**Diary:** Day log · Add-food search · Food detail/quantity · Create custom food
**Prep:** Inventory · Batch detail · Create/Edit batch (start → ingredients → portions → review → confirm) · Recipes list · Recipe detail/edit
**Train:** Train home/history · Active session · Exercise picker/library · Create/edit exercise · (Exercise detail)
**Progress:** Trend dashboard · Add weight entry
**Settings:** Settings home · TDEE calculator
**Shared/modals:** Food search · Quantity/portion control · Date selector · Numeric keypad · Empty/loading/error states

> Approximate count: ~28–30 distinct screens/states for a complete MVP, with the **Prep** cluster being the most design-intensive and the most important to get right.
