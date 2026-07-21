// Seeds a library of shared reference foods (ownerId null — visible to every
// user) so the API returns meaningful data on first run. Skips seeding if
// reference foods already exist, so it's safe to re-run. Run with: npm run db:seed
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Macros per 100g: [name, kcal, protein, fat, carbs, fibre]
const REFERENCE_FOODS: [string, number, number, number, number, number][] = [
  // Proteins
  ['Chicken breast', 165, 31, 3.6, 0, 0],
  ['Chicken thigh (skinless)', 179, 24.8, 8.2, 0, 0],
  ['Beef mince (5% fat)', 137, 21.4, 5, 0, 0],
  ['Beef mince (20% fat)', 254, 17.2, 20, 0, 0],
  ['Pork loin', 143, 26, 3.5, 0, 0],
  ['Salmon fillet', 208, 20.4, 13.4, 0, 0],
  ['Cod fillet', 82, 17.9, 0.7, 0, 0],
  ['Tuna (canned in brine, drained)', 116, 25.5, 0.8, 0, 0],
  ['Prawns', 99, 24, 0.3, 0.2, 0],
  ['Egg (whole)', 143, 12.6, 9.5, 0.7, 0],
  ['Egg white', 52, 10.9, 0.2, 0.7, 0],
  ['Tofu (firm)', 144, 15.5, 8.7, 2.3, 2.3],
  ['Turkey breast mince', 148, 19.7, 7.7, 0, 0],
  // Carbs
  ['Cooked white rice', 130, 2.7, 0.3, 28, 0.4],
  ['Cooked brown rice', 123, 2.7, 1, 25.6, 1.6],
  ['Basmati rice (dry)', 349, 8.1, 0.6, 77.1, 1.4],
  ['Pasta (dry)', 371, 13, 1.5, 74.7, 3.2],
  ['Cooked pasta', 158, 5.8, 0.9, 30.9, 1.8],
  ['Potato', 77, 2, 0.1, 17.5, 2.1],
  ['Sweet potato', 86, 1.6, 0.1, 20.1, 3],
  ['Oats', 379, 13.5, 6.9, 67.7, 10.1],
  ['Bread (wholemeal, slice-weight per 100g)', 247, 13, 3.4, 41.3, 7],
  ['Bread (white)', 265, 9, 3.2, 49, 2.7],
  ['Tortilla wrap', 306, 8.2, 7.7, 49.5, 3.1],
  ['Couscous (dry)', 376, 12.8, 0.6, 77.4, 5],
  ['Quinoa (cooked)', 120, 4.4, 1.9, 21.3, 2.8],
  // Fats & dairy
  ['Olive oil', 884, 0, 100, 0, 0],
  ['Butter', 717, 0.9, 81.1, 0.1, 0],
  ['Cheddar cheese', 403, 24.9, 33.1, 1.3, 0],
  ['Mozzarella', 280, 27.5, 17.1, 3.1, 0],
  ['Greek yogurt (0% fat)', 59, 10.3, 0.4, 3.6, 0],
  ['Whole milk', 61, 3.2, 3.3, 4.8, 0],
  ['Semi-skimmed milk', 47, 3.4, 1.7, 4.8, 0],
  ['Avocado', 160, 2, 14.7, 8.5, 6.7],
  ['Peanut butter', 588, 25.1, 50.4, 20.1, 6],
  ['Almonds', 579, 21.2, 49.9, 21.6, 12.5],
  ['Whey protein powder', 400, 80, 5, 8, 1],
  // Veg & fruit
  ['Broccoli', 34, 2.8, 0.4, 6.6, 2.6],
  ['Spinach', 23, 2.9, 0.4, 3.6, 2.2],
  ['Carrot', 41, 0.9, 0.2, 9.6, 2.8],
  ['Onion', 40, 1.1, 0.1, 9.3, 1.7],
  ['Bell pepper', 31, 1, 0.3, 6, 2.1],
  ['Tomato', 18, 0.9, 0.2, 3.9, 1.2],
  ['Chopped tomatoes (canned)', 32, 1.6, 0.3, 5.4, 1.4],
  ['Mushrooms', 22, 3.1, 0.3, 3.3, 1],
  ['Frozen peas', 81, 5.4, 0.4, 14.5, 5.7],
  ['Banana', 89, 1.1, 0.3, 22.8, 2.6],
  ['Apple', 52, 0.3, 0.2, 13.8, 2.4],
  ['Blueberries', 57, 0.7, 0.3, 14.5, 2.4],
  // Pantry
  ['Chickpeas (canned, drained)', 139, 7.2, 2.6, 19.3, 7.6],
  ['Black beans (canned, drained)', 91, 6, 0.4, 16.6, 6.9],
  ['Red lentils (dry)', 358, 24.6, 1.1, 63.4, 10.7],
  ['Coconut milk (canned)', 197, 2, 21.3, 2.8, 0],
  ['Soy sauce', 53, 8.1, 0.6, 4.9, 0.8],
  ['Honey', 304, 0.3, 0, 82.4, 0.2],
  ['Cornflour', 381, 0.3, 0.1, 91, 0.9],
  ['Sugar', 387, 0, 0, 100, 0],
];

// [name, muscleGroup, equipment, trackingMode, cardioMachine?]
// muscleGroup   — see MUSCLE_GROUPS in src/routes/exercises.ts
// equipment     — see EQUIPMENT in src/routes/exercises.ts
// trackingMode  — see TRACKING_MODES in src/routes/exercises.ts
// cardioMachine — see CARDIO_MACHINES in src/routes/exercises.ts; cardio rows only
const LIBRARY_EXERCISES: [string, string, string, string, string?][] = [
  // Chest — free weights, cables and machines.
  ['Bench press', 'chest', 'barbell', 'weight_reps'],
  ['Incline bench press', 'chest', 'barbell', 'weight_reps'],
  ['Decline bench press', 'chest', 'barbell', 'weight_reps'],
  ['Close-grip bench press', 'chest', 'barbell', 'weight_reps'],
  ['Smith machine bench press', 'chest', 'machine', 'weight_reps'],
  ['Dumbbell bench press', 'chest', 'dumbbell', 'weight_reps'],
  ['Incline dumbbell press', 'chest', 'dumbbell', 'weight_reps'],
  ['Decline dumbbell press', 'chest', 'dumbbell', 'weight_reps'],
  ['Dumbbell fly', 'chest', 'dumbbell', 'weight_reps'],
  ['Incline dumbbell fly', 'chest', 'dumbbell', 'weight_reps'],
  ['Chest fly', 'chest', 'cable', 'weight_reps'],
  ['Low-to-high cable fly', 'chest', 'cable', 'weight_reps'],
  ['High-to-low cable fly', 'chest', 'cable', 'weight_reps'],
  ['Pec deck machine', 'chest', 'machine', 'weight_reps'],
  ['Chest press machine', 'chest', 'machine', 'weight_reps'],
  ['Incline chest press machine', 'chest', 'machine', 'weight_reps'],
  ['Push-up', 'chest', 'bodyweight', 'bodyweight_reps'],
  ['Dip', 'chest', 'bodyweight', 'bodyweight_reps'],
  ['Dip machine', 'chest', 'machine', 'weight_reps'],
  // Back — free weights, cables and machines.
  ['Deadlift', 'back', 'barbell', 'weight_reps'],
  ['Sumo deadlift', 'back', 'barbell', 'weight_reps'],
  ['Rack pull', 'back', 'barbell', 'weight_reps'],
  ['Good morning', 'back', 'barbell', 'weight_reps'],
  ['Barbell row', 'back', 'barbell', 'weight_reps'],
  ['Pendlay row', 'back', 'barbell', 'weight_reps'],
  ['T-bar row', 'back', 'machine', 'weight_reps'],
  ['Dumbbell row', 'back', 'dumbbell', 'weight_reps'],
  ['Single-arm dumbbell row', 'back', 'dumbbell', 'weight_reps'],
  ['Lat pulldown', 'back', 'machine', 'weight_reps'],
  ['Wide-grip lat pulldown', 'back', 'machine', 'weight_reps'],
  ['Close-grip lat pulldown', 'back', 'machine', 'weight_reps'],
  ['Straight-arm pulldown', 'back', 'cable', 'weight_reps'],
  ['Cable pullover', 'back', 'cable', 'weight_reps'],
  ['Seated cable row', 'back', 'cable', 'weight_reps'],
  ['Single-arm cable row', 'back', 'cable', 'weight_reps'],
  ['Machine row', 'back', 'machine', 'weight_reps'],
  ['Assisted pull-up machine', 'back', 'machine', 'weight_reps'],
  ['Pull-up', 'back', 'bodyweight', 'bodyweight_reps'],
  ['Chin-up', 'back', 'bodyweight', 'bodyweight_reps'],
  ['Back extension', 'back', 'bodyweight', 'bodyweight_reps'],
  // Legs — free weights and machines.
  ['Back squat', 'legs', 'barbell', 'weight_reps'],
  ['Front squat', 'legs', 'barbell', 'weight_reps'],
  ['Box squat', 'legs', 'barbell', 'weight_reps'],
  ['Smith machine squat', 'legs', 'machine', 'weight_reps'],
  ['Hack squat machine', 'legs', 'machine', 'weight_reps'],
  ['Romanian deadlift', 'legs', 'barbell', 'weight_reps'],
  ['Stiff-leg deadlift', 'legs', 'barbell', 'weight_reps'],
  ['Leg press', 'legs', 'machine', 'weight_reps'],
  ['Leg extension', 'legs', 'machine', 'weight_reps'],
  ['Leg curl', 'legs', 'machine', 'weight_reps'],
  ['Seated leg curl', 'legs', 'machine', 'weight_reps'],
  ['Hip thrust', 'legs', 'barbell', 'weight_reps'],
  ['Glute bridge', 'legs', 'bodyweight', 'bodyweight_reps'],
  ['Glute ham raise', 'legs', 'bodyweight', 'bodyweight_reps'],
  ['Cable glute kickback', 'legs', 'cable', 'weight_reps'],
  ['Hip adductor machine', 'legs', 'machine', 'weight_reps'],
  ['Hip abductor machine', 'legs', 'machine', 'weight_reps'],
  ['Walking lunge', 'legs', 'dumbbell', 'weight_reps'],
  ['Reverse lunge', 'legs', 'dumbbell', 'weight_reps'],
  ['Bulgarian split squat', 'legs', 'dumbbell', 'weight_reps'],
  ['Step-up', 'legs', 'dumbbell', 'weight_reps'],
  ['Goblet squat', 'legs', 'kettlebell', 'weight_reps'],
  ['Standing calf raise', 'legs', 'machine', 'weight_reps'],
  ['Seated calf raise', 'legs', 'machine', 'weight_reps'],
  // Shoulders — free weights, cables and machines.
  ['Overhead press', 'shoulders', 'barbell', 'weight_reps'],
  ['Landmine press', 'shoulders', 'barbell', 'weight_reps'],
  ['Barbell upright row', 'shoulders', 'barbell', 'weight_reps'],
  ['Barbell shrug', 'shoulders', 'barbell', 'weight_reps'],
  ['Dumbbell shoulder press', 'shoulders', 'dumbbell', 'weight_reps'],
  ['Arnold press', 'shoulders', 'dumbbell', 'weight_reps'],
  ['Lateral raise', 'shoulders', 'dumbbell', 'weight_reps'],
  ['Front raise', 'shoulders', 'dumbbell', 'weight_reps'],
  ['Rear delt fly', 'shoulders', 'dumbbell', 'weight_reps'],
  ['Dumbbell shrug', 'shoulders', 'dumbbell', 'weight_reps'],
  ['Cable lateral raise', 'shoulders', 'cable', 'weight_reps'],
  ['Face pull', 'shoulders', 'cable', 'weight_reps'],
  ['Machine shoulder press', 'shoulders', 'machine', 'weight_reps'],
  ['Machine lateral raise', 'shoulders', 'machine', 'weight_reps'],
  ['Reverse pec deck', 'shoulders', 'machine', 'weight_reps'],
  // Arms — free weights, cables and machines.
  ['Barbell curl', 'arms', 'barbell', 'weight_reps'],
  ['EZ-bar curl', 'arms', 'barbell', 'weight_reps'],
  ['Preacher curl', 'arms', 'barbell', 'weight_reps'],
  ['Reverse curl', 'arms', 'barbell', 'weight_reps'],
  ['Skull crusher', 'arms', 'barbell', 'weight_reps'],
  ['Dumbbell curl', 'arms', 'dumbbell', 'weight_reps'],
  ['Hammer curl', 'arms', 'dumbbell', 'weight_reps'],
  ['Incline dumbbell curl', 'arms', 'dumbbell', 'weight_reps'],
  ['Concentration curl', 'arms', 'dumbbell', 'weight_reps'],
  ['Overhead triceps extension', 'arms', 'dumbbell', 'weight_reps'],
  ['Dumbbell kickback', 'arms', 'dumbbell', 'weight_reps'],
  ['Wrist curl', 'arms', 'dumbbell', 'weight_reps'],
  ['Cable curl', 'arms', 'cable', 'weight_reps'],
  ['Triceps pushdown', 'arms', 'cable', 'weight_reps'],
  ['Rope triceps pushdown', 'arms', 'cable', 'weight_reps'],
  ['Machine bicep curl', 'arms', 'machine', 'weight_reps'],
  ['Triceps dip machine', 'arms', 'machine', 'weight_reps'],
  // Core.
  ['Plank', 'core', 'bodyweight', 'time'],
  ['Side plank', 'core', 'bodyweight', 'time'],
  ['Crunch', 'core', 'bodyweight', 'bodyweight_reps'],
  ['Sit-up', 'core', 'bodyweight', 'bodyweight_reps'],
  ['Decline sit-up', 'core', 'bodyweight', 'bodyweight_reps'],
  ['Hanging leg raise', 'core', 'bodyweight', 'bodyweight_reps'],
  ['Hanging knee raise', 'core', 'bodyweight', 'bodyweight_reps'],
  ['Ab wheel rollout', 'core', 'bodyweight', 'bodyweight_reps'],
  ['Russian twist', 'core', 'bodyweight', 'bodyweight_reps'],
  ['Cable crunch', 'core', 'cable', 'weight_reps'],
  ['Cable woodchopper', 'core', 'cable', 'weight_reps'],
  ['Machine crunch', 'core', 'machine', 'weight_reps'],
  // Full body / cardio.
  ['Kettlebell swing', 'full_body', 'kettlebell', 'weight_reps'],
  ['Clean and jerk', 'full_body', 'barbell', 'weight_reps'],
  ['Snatch', 'full_body', 'barbell', 'weight_reps'],
  ['Thruster', 'full_body', 'barbell', 'weight_reps'],
  ['Farmer\u2019s carry', 'full_body', 'dumbbell', 'distance'],
  ['Battle ropes', 'full_body', 'other', 'time'],
  ['Sled push', 'full_body', 'other', 'distance'],
  ['Burpee', 'full_body', 'bodyweight', 'bodyweight_reps'],
  ['Rowing machine', 'cardio', 'machine', 'distance', 'rower'],
  ['Treadmill run', 'cardio', 'machine', 'distance', 'treadmill'],
  ['Outdoor run', 'cardio', 'bodyweight', 'distance', 'outdoor'],
  ['Cycling', 'cardio', 'machine', 'time', 'bike'],
  ['Assault bike', 'cardio', 'machine', 'time', 'bike'],
  ['Elliptical', 'cardio', 'machine', 'time', 'elliptical'],
  ['Stair climber', 'cardio', 'machine', 'time', 'stair_climber'],
];

async function seedExercises() {
  // Add-missing-by-name rather than all-or-nothing skip, so expanding the
  // library and re-running `db:seed` fills in new exercises on a database
  // that was already seeded, without duplicating existing ones.
  const existingNames = new Set(
    (await prisma.exercise.findMany({ where: { ownerId: null }, select: { name: true } })).map(
      (e) => e.name,
    ),
  );
  const toCreate = LIBRARY_EXERCISES.filter(([name]) => !existingNames.has(name));
  if (toCreate.length > 0) {
    await prisma.exercise.createMany({
      data: toCreate.map(([name, muscleGroup, equipment, trackingMode, cardioMachine]) => ({
        name,
        muscleGroup,
        equipment,
        trackingMode,
        cardioMachine: cardioMachine ?? null,
      })),
    });
    console.log(
      `Seeded ${toCreate.length} new library exercises (${existingNames.size} already present).`,
    );
  } else {
    console.log(`Library exercises already seeded (${existingNames.size} present) — skipping.`);
  }

  // Backfill cardioMachine onto cardio rows seeded before the column existed.
  // No-op once every seeded cardio exercise is tagged.
  for (const [name, , , , cardioMachine] of LIBRARY_EXERCISES) {
    if (!cardioMachine) continue;
    await prisma.exercise.updateMany({
      where: { name, ownerId: null, cardioMachine: null },
      data: { cardioMachine },
    });
  }
}

async function main() {
  await seedExercises();

  const existing = await prisma.food.count({ where: { ownerId: null } });
  if (existing > 0) {
    console.log(`Reference foods already seeded (${existing} present) — skipping.`);
    return;
  }

  await prisma.food.createMany({
    data: REFERENCE_FOODS.map(([name, kcal, protein, fat, carbs, fibre]) => ({
      name,
      kcal,
      protein,
      fat,
      carbs,
      fibre,
    })),
  });

  // Batches are user-owned (F5-1), so no example batch is seeded any more —
  // cook one through the app instead.
  console.log(`Seeded ${REFERENCE_FOODS.length} reference foods.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
