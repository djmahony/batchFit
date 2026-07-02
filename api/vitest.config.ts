import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Point Prisma at a throwaway SQLite file so tests never touch dev.db.
    env: { DATABASE_URL: 'file:./test.db' },
    globalSetup: './src/test/globalSetup.ts',
    // Endpoint tests share one database; run files serially to avoid races.
    fileParallelism: false,
  },
});
