import type { INestApplication, ModuleMetadata } from '@nestjs/common';
import { InMemoryMailTransport } from '@nestjs/mail';
import type { Redis } from 'ioredis';
import { inject } from 'vitest';
import { createApp } from '../../src/bootstrap/create-app.js';
import { parseEnv } from '../../src/config/env.js';
import { REDIS_CLIENT } from '../../src/infra/redis/redis.module.js';
import { resetDatabase } from './reset-database.js';

export const TEST_WEB_ORIGIN = 'http://localhost:5173';

/** Everything the app needs except the container URLs. Tests override single values. */
const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  APP_NAME: 'test-app',
  APP_URL: 'http://localhost:3000',
  WEB_APP_URL: TEST_WEB_ORIGIN,
  // Raise to 'debug' to see the app's logs while debugging a test.
  LOG_LEVEL: 'silent',
  CORS_ORIGINS: TEST_WEB_ORIGIN,
  CSRF_ENABLED: 'true',
  COOKIE_SECRET: 'test-cookie-secret-of-at-least-32-characters',
  SWAGGER_ENABLED: 'false',
  MAIL_TRANSPORT: 'log',
  MAIL_FROM: 'no-reply@example.com',
  THROTTLE_TTL: '60000',
  THROTTLE_LIMIT: '1000',
  // High enough for any test; the rate-limit tests lower them.
  AUTH_THROTTLE_REGISTER: '1000/1m',
  AUTH_THROTTLE_LOGIN: '1000/1m',
  AUTH_THROTTLE_MAIL: '1000/1m',
  AUTH_THROTTLE_RESET: '1000/1m',
  JWT_SECRET: 'test-jwt-secret-of-at-least-32-characters',
};

export interface TestApp {
  app: INestApplication;
  /** e.g. `http://127.0.0.1:54321`; call it with `fetch`, so tests don't depend on the platform. */
  baseUrl: string;
  /** Every mail the app sent. */
  mailbox: InMemoryMailTransport;
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
 * `overrides` replace single environment variables.
 */
export async function createTestApp(
  overrides: Record<string, string> = {},
  { extraImports, skipInitialReset = false }: TestAppOptions = {},
): Promise<TestApp> {
  const env = parseEnv({ ...TEST_ENV, ...inject('containerEnv'), ...overrides });
  const mailbox = new InMemoryMailTransport();
  const app = await createApp({ env, mailTransport: mailbox, extraImports });
  await app.listen(0);

  const reset = async (): Promise<void> => {
    await resetDatabase(app);
    await app.get<Redis>(REDIS_CLIENT).flushdb();
    mailbox.clear();
  };
  if (!skipInitialReset) await reset();

  return { app, baseUrl: await app.getUrl(), mailbox, reset, close: () => app.close() };
}
