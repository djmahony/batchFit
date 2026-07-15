// Seeds a library of shared reference foods (ownerId null — visible to every user)
// and one example batch ("Chicken & Rice", split 6 ways) so the API returns
// meaningful data on first run. Skips food seeding if reference foods already
// exist, so it's safe to re-run. Run with: npm run db:seed
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

async function main() {
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

  const chicken = await prisma.food.findFirst({ where: { name: 'Chicken breast' } });
  const rice = await prisma.food.findFirst({ where: { name: 'Cooked white rice' } });
  const cornflour = await prisma.food.findFirst({ where: { name: 'Cornflour' } });

  await prisma.batch.create({
    data: {
      name: 'Chicken & Rice',
      portionsTotal: 6,
      portionsRemaining: 6,
      ingredients: {
        create: [
          { foodId: chicken!.id, grams: 1200 },
          { foodId: rice!.id, grams: 800 },
          { foodId: cornflour!.id, grams: 250 },
        ],
      },
    },
  });

  console.log(`Seeded ${REFERENCE_FOODS.length} reference foods and one example batch.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
