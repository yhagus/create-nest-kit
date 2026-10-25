import type { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import { REDIS_CLIENT } from '../../src/infra/redis/redis.module.js';
import { createTestApp, type TestApp } from '../support/app.js';

describe('GET /health', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    // A limit of one request shows that load balancers polling /health are never rate-limited.
    testApp = await createTestApp({ THROTTLE_LIMIT: '1' });
  });

  afterAll(async () => {
    await testApp.close();
  });

  // The other tests run after createTestApp() has queried the database; a health check must not
  // depend on that (MikroORM's checkConnection() reported a pool without a query yet as down).
  it('reports the database and Redis as up on a cold start, before anything has queried them', async () => {
    const coldApp = await createTestApp({}, { skipInitialReset: true });
    onTestFinished(() => coldApp.close());

    const response = await fetch(`${coldApp.baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      info: { database: { status: 'up' }, redis: { status: 'up' } },
    });
  });

  it('reports the database and Redis as up', async () => {
    const response = await fetch(`${testApp.baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'ok',
      info: { database: { status: 'up' }, redis: { status: 'up' } },
    });
  });

  it('needs no access token and is never rate-limited', async () => {
    await fetch(`${testApp.baseUrl}/health`);

    const response = await fetch(`${testApp.baseUrl}/health`);

    expect(response.status).toBe(200);
  });

  it('answers 503 naming the failing check when Redis is down', async () => {
    // An app of its own, so the other tests never see Redis down, whatever their order.
    const appWithoutRedis = await createTestApp();
    onTestFinished(() => appWithoutRedis.close());
    const redis = appWithoutRedis.app.get<Redis>(REDIS_CLIENT);
    redis.disconnect();

    const response = await fetch(`${appWithoutRedis.baseUrl}/health`);
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
