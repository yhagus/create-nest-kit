import { RedisContainer } from '@testcontainers/redis';
import { inspect } from 'node:util';
import type { TestProject } from 'vitest/node';
import { startDatabase } from './database.global-setup.js';

const REDIS_IMAGE = 'redis:8-alpine';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Env vars pointing at the containers: REDIS_URL plus the database's. */
    containerEnv: { REDIS_URL: string; [key: string]: string };
  }
}

/** Starts the containers once for the whole run; test files read their URLs with `inject()`. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  try {
    const [redis, database] = await Promise.all([
      new RedisContainer(REDIS_IMAGE).start(),
      startDatabase(),
    ]);
    project.provide('containerEnv', { REDIS_URL: redis.getConnectionUrl(), ...database.env });

    return async () => {
      await Promise.all([redis.stop(), database.stop()]);
    };
  } catch (error) {
    // Vitest can hide a failed global setup behind its own "code.charCodeAt is not a function",
    // so print the real error before rethrowing it.
    console.error('Test containers failed to start:', inspect(error, { depth: 5 }));
    throw error;
  }
}
