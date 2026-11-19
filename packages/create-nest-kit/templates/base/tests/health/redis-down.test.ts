import type { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REDIS_CLIENT } from '../../src/infra/redis/redis.module.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('GET /health with Redis down', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('answers 503 naming the failing check', async () => {
    // Cuts this app's connection rather than stopping the container the other test files share.
    const redis = testApp.app.get<Redis>(REDIS_CLIENT);
    redis.disconnect();

    const response = await fetch(`${testApp.baseUrl}/health`);
    // Reconnected, so the app shuts down cleanly.
    await redis.connect();

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      statusCode: 503,
      errorCode: 'SERVICE_UNAVAILABLE',
      details: { database: { status: 'up' }, redis: { status: 'down' } },
    });
  });
});
