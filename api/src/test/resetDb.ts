import { prisma } from '../prisma.js';

/**
 * Clears every table in FK-safe order. Endpoint suites share one test.db and
 * run serially, so each file must clear *all* data — not just its own tables —
 * or another file's leftovers break deleteMany with FK violations.
 */
export async function resetDb() {
  await prisma.workout.deleteMany(); // workout exercises + sets cascade
  await prisma.logEntry.deleteMany();
  await prisma.batch.deleteMany(); // batch ingredients cascade
  await prisma.recipe.deleteMany(); // recipe ingredients cascade
  await prisma.food.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.user.deleteMany();
}
