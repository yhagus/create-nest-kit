// `db:migrate`: brings the database's indexes in line with the schemas in ./schemas/.
// MongoDB needs no table migrations; indexes are the only schema it enforces. Safe to run again.
// Runs compiled (`nest start --entryFile database/migrate`), so the schemas' decorators work.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseDatabaseEnv } from '../config/database.env.js';
import { InvalidEnvError } from '../config/env-contract.js';
import { importSchemas, syncIndexes } from './sync-indexes.js';

const ENV_FILE = '.env';

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const databaseEnv = parseDatabaseEnv(process.env);
if (!databaseEnv.success) {
  throw new InvalidEnvError(databaseEnv.issues);
}
const { MONGODB_URI } = databaseEnv.env;
const schemas = await importSchemas(path.join(import.meta.dirname, 'schemas'));
const dropped = await syncIndexes(MONGODB_URI, schemas);

for (const [collection, indexes] of Object.entries(dropped)) {
  if (indexes.length > 0) console.log(`Dropped from ${collection}: ${indexes.join(', ')}`);
}
console.log(`Indexes are in sync for ${schemas.length} collections`);
