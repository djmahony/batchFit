-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "sex" TEXT,
    "birthDate" DATETIME,
    "heightCm" REAL,
    "activityLevel" TEXT,
    "goal" TEXT,
    "goalRateKgPerWk" REAL,
    "currentWeightKg" REAL,
    "goalWeightKg" REAL,
    "units" TEXT NOT NULL DEFAULT 'metric',
    "targetKcal" REAL,
    "targetProtein" REAL,
    "targetFat" REAL,
    "targetCarbs" REAL,
    "targetFibre" REAL,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
