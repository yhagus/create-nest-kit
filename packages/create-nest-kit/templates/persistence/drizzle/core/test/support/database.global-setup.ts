import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { startPostgres } from './postgres.container.js';

export interface StartedDatabase {
  /** Environment variables that point the app at the database. */
  env: Record<string, string>;
  stop(): Promise<void>;
}

/** Starts Postgres and applies the migrations in drizzle/. */
export async function startDatabase(): Promise<StartedDatabase> {
  const container = await startPostgres();
  const databaseUrl = container.getConnectionUri();

  const db = drizzle({ connection: databaseUrl });
  try {
    await migrate(db, { migrationsFolder: 'drizzle' });
  } finally {
    await db.$client.end();
  }

  return {
    env: { DATABASE_URL: databaseUrl },
    stop: async () => {
      await container.stop();
    },
  };
}
