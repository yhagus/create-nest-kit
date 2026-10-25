// The data source of the TypeORM CLI (db:migrate, db:migration:create). The app connects
// through DatabaseModule instead. The CLI loads the compiled file, dist/database/data-source.js,
// so the globs below match the compiled entities and migrations next to it.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DataSource } from 'typeorm';

const ENV_FILE = '.env';

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [path.join(import.meta.dirname, '**/*.entity.js')],
  migrations: [path.join(import.meta.dirname, 'migrations/*.js')],
});
