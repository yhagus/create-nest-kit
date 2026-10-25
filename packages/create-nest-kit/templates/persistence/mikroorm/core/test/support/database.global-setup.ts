import { Migrator } from '@mikro-orm/migrations';
import { MikroORM } from '@mikro-orm/postgresql';
import { startPostgres } from './postgres.container.js';

export interface StartedDatabase {
  /** Environment variables that point the app at the database. */
  env: Record<string, string>;
  stop(): Promise<void>;
}

/** Starts Postgres and applies the migrations in src/database/migrations/. */
export async function startDatabase(): Promise<StartedDatabase> {
  const container = await startPostgres();
  const databaseUrl = container.getConnectionUri();

  const orm = await MikroORM.init({
    clientUrl: databaseUrl,
    // Migrations run raw SQL; they need no entities.
    entities: [],
    discovery: { warnWhenNoEntities: false },
    extensions: [Migrator],
    // No snapshot file: the CLI diffs against the database, and the run must not write to src/.
    migrations: { path: 'src/database/migrations', snapshot: false, silent: true },
    // Imports the TypeScript migrations through Vitest's transform, not Node's own loader.
    dynamicImportProvider: (id) => import(id),
  });
  try {
    await orm.migrator.up();
  } finally {
    await orm.close();
  }

  return {
    env: { DATABASE_URL: databaseUrl },
    stop: async () => {
      await container.stop();
    },
  };
}
