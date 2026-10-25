import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { startPostgres } from './postgres.container.js';

const run = promisify(execFile);

export interface StartedDatabase {
  /** Environment variables that point the app at the database. */
  env: Record<string, string>;
  stop(): Promise<void>;
}

/** Starts Postgres and applies the migrations in prisma/migrations/. */
export async function startDatabase(): Promise<StartedDatabase> {
  const container = await startPostgres();
  const databaseUrl = container.getConnectionUri();

  // The package manager puts node_modules/.bin on the PATH of `test:e2e`.
  await run('prisma', ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  return {
    env: { DATABASE_URL: databaseUrl },
    stop: async () => {
      await container.stop();
    },
  };
}
