-- AlterTable
ALTER TABLE "WorkoutExercise" ADD COLUMN "cardioMachine" TEXT;

-- AlterTable
ALTER TABLE "WorkoutSet" ADD COLUMN "inclinePct" REAL;
ALTER TABLE "WorkoutSet" ADD COLUMN "lengths" INTEGER;
ALTER TABLE "WorkoutSet" ADD COLUMN "level" INTEGER;
