-- Workouts aren't timed anymore: replace `startedAt` (a precise instant) with
-- `date` (an editable day key, "YYYY-MM-DD"). Existing rows backfill `date`
-- from the date portion of their old `startedAt`.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Workout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Workout" ("id", "userId", "date", "finishedAt", "createdAt", "updatedAt")
SELECT "id", "userId", date(CAST(substr("startedAt", 1, 10) AS INTEGER), 'unixepoch'), "finishedAt", "createdAt", "updatedAt" FROM "Workout";
DROP TABLE "Workout";
ALTER TABLE "new_Workout" RENAME TO "Workout";
CREATE INDEX "Workout_userId_date_idx" ON "Workout"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
