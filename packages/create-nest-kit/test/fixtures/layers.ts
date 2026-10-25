import { fileURLToPath } from 'node:url';
import type { LayerManifest, LayerSet } from '../../src/layers/types.ts';

/**
 * A tiny stand-in for the real layers: the same ids, all `ready`, for the
 * default combo, one file per slot, plus one `planned` layer. Also loaded by
 * the built CLI in cli.test.ts through NEST_KIT_LAYER_SET_MODULE, so it must
 * stay runnable by plain Node.
 */
export const fixtureLayers: LayerManifest[] = [
  {
    id: 'base',
    status: 'ready',
    when: () => true,
    dependencies: { '@nestjs/core': '12.2.0', '@nestjs/common': '12.2.0' },
    devDependencies: { typescript: '6.0.3', vitest: '5.0.5' },
    scripts: {
      'start:dev': 'nest start --watch',
      build: 'nest build',
      lint: 'oxlint',
      typecheck: 'tsc --noEmit',
      test: 'vitest run',
      'test:e2e': 'vitest run --config vitest.e2e.config.ts',
    },
    env: [
      { key: 'PORT', value: '3000', comment: 'HTTP port' },
      { key: 'APP_NAME', value: (options) => options.name },
      { key: 'COOKIE_SECRET', value: 'change-me', secret: true },
    ],
    compose: {
      services: { mailpit: { image: 'axllent/mailpit:v1.27', ports: ['8025:8025', '1025:1025'] } },
    },
    readme: [{ title: 'Architecture', body: 'Shared code lives in `src/`.' }],
  },
  {
    id: 'platform/fastify',
    status: 'ready',
    when: (options) => options.platform === 'fastify',
    dependencies: { '@nestjs/platform-fastify': '12.2.0' },
  },
  {
    id: 'database/postgres',
    status: 'ready',
    when: (options) => options.database === 'postgres',
    env: [{ key: 'DATABASE_URL', value: 'postgres://app:app@localhost:5432/app' }],
    compose: {
      services: {
        postgres: { image: 'postgres:18-alpine', volumes: ['pgdata:/var/lib/postgresql'] },
      },
      volumes: ['pgdata'],
    },
  },
  {
    id: 'validation/zod',
    status: 'ready',
    when: (options) => options.validation === 'zod',
  },
  {
    id: 'validation/valibot',
    status: 'planned',
    when: (options) => options.validation === 'valibot',
  },
  {
    id: 'persistence/drizzle/core',
    status: 'ready',
    when: (options) => options.orm === 'drizzle',
    dependencies: { 'drizzle-orm': '0.45.4' },
    scripts: { 'db:migrate': 'drizzle-kit migrate', 'db:seed': 'node src/database/seed.ts' },
    packageJson: { pnpm: { onlyBuiltDependencies: ['esbuild'] } },
  },
  {
    id: 'auth/jwt',
    status: 'ready',
    when: (options) => options.auth === 'jwt',
    env: [{ key: 'JWT_SECRET', value: 'change-me', secret: true, comment: 'Signs access tokens' }],
    readme: [
      {
        title: 'Authentication',
        body: (options) => `Email verification is ${options.emailVerification ? 'on' : 'off'}.`,
      },
    ],
  },
];

/** Provides `src/main.ts`, which `base` already provides. */
export const collidingLayer: LayerManifest = { id: 'collide', status: 'ready', when: () => true };

export const fixtureTemplatesDir = fileURLToPath(new URL('./templates/', import.meta.url));

export const layerSet: LayerSet = { layers: fixtureLayers, templatesDir: fixtureTemplatesDir };
