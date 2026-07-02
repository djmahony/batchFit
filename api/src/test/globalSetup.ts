import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

// Give the suite a clean database: delete the throwaway test DB, then let
// `prisma db push` recreate the schema from scratch. Deleting the file first
// avoids the destructive `--force-reset` path.
export default function setup() {
  rmSync('prisma/test.db', { force: true });
  rmSync('prisma/test.db-journal', { force: true });
  execSync('npx prisma db push --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}
