import { RedisContainer } from '@testcontainers/redis';
import { GenericContainer, Wait } from 'testcontainers';
import { inspect } from 'node:util';
import type { TestProject } from 'vitest/node';
import { startDatabase } from './database.global-setup.js';
import { runPackageScript } from './package-script.js';
import { TEST_ENV } from './test-env.js';

const REDIS_IMAGE = 'redis:8-alpine';
const MAILPIT_IMAGE = 'axllent/mailpit';
const MAILPIT_SMTP_PORT = 1025;
const MAILPIT_HTTP_PORT = 8025;

declare module 'vitest' {
  export interface ProvidedContext {
    /** Env vars pointing the app at the containers: REDIS_URL, SMTP_URL and the database's. */
    containerEnv: { REDIS_URL: string; SMTP_URL: string; [key: string]: string };
    /** Only the database's env vars, e.g. `{ DATABASE_URL }`. */
    databaseEnv: Record<string, string>;
    /** Mailpit's HTTP API, where tests read the mail the app sent. */
    mailpitUrl: string;
  }
}

/**
 * Starts the containers once for the whole run and migrates the database with the project's own
 * `db:migrate`; test files read the URLs with `inject()`.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  try {
    const [redis, mailpit, database] = await Promise.all([
      new RedisContainer(REDIS_IMAGE).start(),
      new GenericContainer(MAILPIT_IMAGE)
        .withExposedPorts(MAILPIT_SMTP_PORT, MAILPIT_HTTP_PORT)
        .withWaitStrategy(Wait.forHttp('/readyz', MAILPIT_HTTP_PORT))
        .start(),
      startDatabase(),
    ]);
    const mailpitHost = mailpit.getHost();
    const containerEnv = {
      REDIS_URL: redis.getConnectionUrl(),
      SMTP_URL: `smtp://${mailpitHost}:${mailpit.getMappedPort(MAILPIT_SMTP_PORT)}`,
      ...database.env,
    };
    await runPackageScript('db:migrate', { ...TEST_ENV, ...containerEnv });

    project.provide('containerEnv', containerEnv);
    project.provide('databaseEnv', database.env);
    project.provide(
      'mailpitUrl',
      `http://${mailpitHost}:${mailpit.getMappedPort(MAILPIT_HTTP_PORT)}`,
    );

    return async () => {
      await Promise.all([redis.stop(), mailpit.stop(), database.stop()]);
    };
  } catch (error) {
    // Vitest can hide a failed global setup behind its own "code.charCodeAt is not a function",
    // so print the real error before rethrowing it.
    console.error('Test containers failed to start:', inspect(error, { depth: 5 }));
    throw error;
  }
}
