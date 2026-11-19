import { PostgreSqlContainer } from '@testcontainers/postgresql';

const POSTGRES_IMAGE = 'postgres:18-alpine';

export interface StartedDatabase {
  /** Environment variables that point the app at the database. */
  env: Record<string, string>;
  stop(): Promise<void>;
}

/** Starts an empty Postgres; the global setup migrates it with `db:migrate`. */
export async function startDatabase(): Promise<StartedDatabase> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  return {
    env: { DATABASE_URL: container.getConnectionUri() },
    stop: async () => {
      await container.stop();
    },
  };
}
