// Seeds a few reference foods and one example batch ("Chicken & Rice", split 6 ways)
// so the API returns meaningful data on first run. Run with: npm run db:seed
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const chicken = await prisma.food.create({
    data: { name: 'Chicken breast', kcal: 165, protein: 31, fat: 3.6, carbs: 0, fibre: 0 },
  });
  const rice = await prisma.food.create({
    data: { name: 'Cooked white rice', kcal: 130, protein: 2.7, fat: 0.3, carbs: 28, fibre: 0.4 },
  });
  const cornflour = await prisma.food.create({
    data: { name: 'Cornflour', kcal: 381, protein: 0.3, fat: 0.1, carbs: 91, fibre: 0.9 },
  });

  await prisma.batch.create({
    data: {
      name: 'Chicken & Rice',
      portionsTotal: 6,
      portionsRemaining: 6,
      ingredients: {
        create: [
          { foodId: chicken.id, grams: 1200 },
          { foodId: rice.id, grams: 800 },
          { foodId: cornflour.id, grams: 250 },
        ],
      },
    },
  });

  console.log('Seeded foods and one example batch.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
