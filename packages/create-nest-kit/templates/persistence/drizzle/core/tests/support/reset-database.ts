import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../../src/database/database.js';

/**
 * Empties every table in the `public` schema. Drizzle keeps its migration history in
 * the separate `drizzle` schema, so that survives.
 */
export async function resetDatabase(app: INestApplication): Promise<void> {
  const db = app.get<Database>(DATABASE);
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  if (rows.length === 0) return;

  const tables = sql.join(
    rows.map(({ tablename }) => sql.identifier(tablename)),
    sql`, `,
  );
  await db.execute(sql`truncate table ${tables} restart identity cascade`);
}
