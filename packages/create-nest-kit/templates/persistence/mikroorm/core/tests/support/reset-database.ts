import { MikroORM } from '@mikro-orm/postgresql';
import type { INestApplication } from '@nestjs/common';

/**
 * Empties the table of every entity the app registered. MikroORM's migration history
 * (the `mikro_orm_migrations` table) has no entity, so it survives.
 */
export async function resetDatabase(app: INestApplication): Promise<void> {
  await app.get(MikroORM).schema.clear();
}
