-- CreateTable
CREATE TABLE "OneRepMaxEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "weightKg" REAL NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OneRepMaxEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OneRepMaxEntry_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OneRepMaxEntry_userId_exerciseId_date_idx" ON "OneRepMaxEntry"("userId", "exerciseId", "date");
