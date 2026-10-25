import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { DataSource, type MigrationInterface } from 'typeorm';
import { startPostgres } from './postgres.container.js';

const MIGRATIONS_DIR = path.resolve('src/database/migrations');

type MigrationClass = new () => MigrationInterface;

export interface StartedDatabase {
  /** Environment variables that point the app at the database. */
  env: Record<string, string>;
  stop(): Promise<void>;
}

/** Starts Postgres and applies the migrations in src/database/migrations/. */
export async function startDatabase(): Promise<StartedDatabase> {
  const container = await startPostgres();
  const databaseUrl = container.getConnectionUri();

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    migrations: await importMigrations(),
  });
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }

  return {
    env: { DATABASE_URL: databaseUrl },
    stop: async () => {
      await container.stop();
    },
  };
}

/**
 * Imports the migration classes here rather than giving TypeORM a glob: TypeORM would import
 * the TypeScript files itself, bypassing Vitest's transform.
 */
async function importMigrations(): Promise<MigrationClass[]> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.ts'));
  // A module namespace object: one property per export.
  const modules: Record<string, unknown>[] = await Promise.all(
    files.map((file) => import(path.join(MIGRATIONS_DIR, file))),
  );
  return modules.flatMap((module) => Object.values(module).filter(isMigrationClass));
}

function isMigrationClass(value: unknown): value is MigrationClass {
  return typeof value === 'function' && typeof value.prototype?.up === 'function';
}
