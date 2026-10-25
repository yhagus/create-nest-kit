// The configuration of the MikroORM CLI (db:migrate, db:migration:create). The app connects
// through DatabaseModule instead. The CLI loads the compiled file, dist/mikro-orm.config.js
// (package.json sets `mikro-orm.preferTs: false`), so the entity glob matches compiled files.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';

const ENV_FILE = '.env';

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

export default defineConfig({
  clientUrl: databaseUrl,
  // Every *.entity.ts of every layer, so an auth layer's entities need no edit here.
  entities: [path.join(import.meta.dirname, '**/*.entity.js')],
  extensions: [Migrator],
  migrations: {
    // Runs the compiled migrations; writes new ones as TypeScript next to the others in src/.
    path: path.join(import.meta.dirname, 'database/migrations'),
    pathTs: 'src/database/migrations',
    emit: 'ts',
    // Diff the entities against the database itself rather than a snapshot file, which no
    // single layer could own.
    snapshot: false,
  },
});
