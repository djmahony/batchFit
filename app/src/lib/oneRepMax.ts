// Estimated one-rep max (Epley: weight × (1 + reps / 30)), mirroring the
// API's src/oneRepMax.ts — keep the two in sync. Used for the live per-set
// estimate in the active session, so it must stay a pure local computation.

/** Estimated 1RM in kg, rounded to 1 decimal. A single rep is its own max;
 *  zero/negative inputs return 0. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps <= 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}
