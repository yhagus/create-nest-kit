import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Empties the table of every entity the app registered. TypeORM's migration history
 * (the `migrations` table) has no entity, so it survives.
 */
export async function resetDatabase(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  const tables = dataSource.entityMetadatas.map((metadata) =>
    dataSource.driver.escape(metadata.tablePath),
  );
  if (tables.length === 0) return;

  await dataSource.query(`truncate table ${tables.join(', ')} restart identity cascade`);
}
