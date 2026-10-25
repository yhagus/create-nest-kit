import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

/**
 * Empties every collection. Deletes the documents rather than dropping the collections, which
 * would drop the indexes the global setup created, unique ones included.
 */
export async function resetDatabase(app: INestApplication): Promise<void> {
  const { db } = app.get<Connection>(getConnectionToken());
  if (!db) throw new Error('The app is not connected to MongoDB');

  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}
