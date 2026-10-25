import path from 'node:path';
import { importSchemas, syncIndexes } from '../../src/database/sync-indexes.js';
import { startMongoDB } from './mongodb.container.js';

const SCHEMAS_DIR = path.resolve('src/database/schemas');

export interface StartedDatabase {
  /** Environment variables that point the app at the database. */
  env: Record<string, string>;
  stop(): Promise<void>;
}

/** Starts MongoDB and creates the indexes, like `db:migrate`. */
export async function startDatabase(): Promise<StartedDatabase> {
  const { container, uri } = await startMongoDB();
  await syncIndexes(uri, await importSchemas(SCHEMAS_DIR));

  return {
    env: { MONGODB_URI: uri },
    stop: async () => {
      await container.stop();
    },
  };
}
