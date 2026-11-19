import type { INestApplication, ModuleMetadata } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { inject } from 'vitest';
import { createApp } from '../../src/bootstrap/create-app.js';
import { parseEnv } from '../../src/config/env.js';
import { REDIS_CLIENT } from '../../src/infra/redis/redis.module.js';
import { clearMailbox } from './mail.js';
import { resetDatabase } from './reset-database.js';
import { TEST_ENV } from './test-env.js';

export interface TestApp {
  app: INestApplication;
  /** e.g. `http://127.0.0.1:54321`; call it with `fetch`, so tests don't depend on the platform. */
  baseUrl: string;
  /** Empties the database, Redis and the mailbox. Call it in `beforeEach`. */
  reset(): Promise<void>;
  close(): Promise<void>;
}

export interface TestAppOptions {
  /** Extra modules to mount, e.g. one with a test-only controller. */
  extraImports?: ModuleMetadata['imports'];
  /**
   * Don't reset before returning, so the app is as it was right after boot: nothing has queried
   * the database yet and connection pools may still be empty.
   */
  skipInitialReset?: boolean;
}

/**
 * Boots the real app (`createApp()`) against the test containers, on a random port.
 * `overrides` replace single environment variables; `undefined` removes one. Rejects, as the app
 * does on start-up, when the resulting environment is invalid.
 */
export async function createTestApp(
  overrides: Record<string, string | undefined> = {},
  { extraImports, skipInitialReset = false }: TestAppOptions = {},
): Promise<TestApp> {
  const env = parseEnv({ ...TEST_ENV, ...inject('containerEnv'), ...overrides });
  const app = await createApp({ env, extraImports });
  await app.listen(0);

  const reset = async (): Promise<void> => {
    await resetDatabase(app);
    await app.get<Redis>(REDIS_CLIENT).flushdb();
    await clearMailbox();
  };
  if (!skipInitialReset) await reset();

  return { app, baseUrl: await app.getUrl(), reset, close: () => app.close() };
}
