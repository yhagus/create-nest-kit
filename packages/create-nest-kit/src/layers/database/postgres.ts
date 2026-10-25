import { TESTCONTAINERS_VERSION } from '../base.ts';
import type { LayerManifest } from '../types.ts';

export const postgresLayer: LayerManifest = {
  id: 'database/postgres',
  status: 'ready',
  when: (options) => options.database === 'postgres',
  devDependencies: {
    '@testcontainers/postgresql': TESTCONTAINERS_VERSION,
  },
  env: [{ key: 'DATABASE_URL', value: 'postgres://app:app@localhost:5432/app' }],
  compose: {
    services: {
      postgres: {
        image: 'postgres:18-alpine',
        environment: { POSTGRES_USER: 'app', POSTGRES_PASSWORD: 'app', POSTGRES_DB: 'app' },
        ports: ['5432:5432'],
        // Postgres 18 images keep data in a versioned folder below /var/lib/postgresql.
        volumes: ['postgres-data:/var/lib/postgresql'],
        healthcheck: {
          test: ['CMD-SHELL', 'pg_isready -U app -d app'],
          interval: '5s',
          timeout: '3s',
          retries: 10,
        },
      },
    },
    volumes: ['postgres-data'],
  },
};
