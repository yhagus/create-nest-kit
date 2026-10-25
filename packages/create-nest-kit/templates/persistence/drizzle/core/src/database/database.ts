import { getDrizzleToken, InjectDrizzle } from '@nestjs/drizzle';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/** The Drizzle database. Use the core query builder: `db.select().from(users)`. */
export type Database = NodePgDatabase;

/** Injection token of the database, e.g. for `app.get(DATABASE)` in tests. */
export const DATABASE = getDrizzleToken();

/** Injects the database: `constructor(@InjectDatabase() private readonly db: Database)`. */
export const InjectDatabase = (): PropertyDecorator & ParameterDecorator => InjectDrizzle();
