import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import { createTestApp, type TestApp } from '../support/test-app.js';

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
});
