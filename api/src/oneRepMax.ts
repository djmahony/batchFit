// Estimated one-rep max from a working set, using the Epley formula:
// weight × (1 + reps / 30). The same formula is mirrored client-side for the
// live per-set estimate (app/src/lib/oneRepMax.ts) — keep them in sync.

/** Estimated 1RM in kg, rounded to 1 decimal. A single rep is its own max
 *  (no extrapolation); zero/negative inputs return 0. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps <= 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}
