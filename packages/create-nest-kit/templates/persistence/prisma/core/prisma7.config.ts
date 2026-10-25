import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

const ENV_FILE = '.env';

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

export default defineConfig({
  schema: 'prisma/schema',
  migrations: { path: 'prisma/migrations' },
  // Optional here so `prisma generate` runs on install without a database (e.g. in CI);
  // the commands that connect fail with a clear message when it is unset.
  datasource: { url: process.env['DATABASE_URL'] },
});
