import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedSystemRoles, TEST_PASSWORD } from '../support/auth.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('rate limits', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({
      AUTH_THROTTLE_REGISTER: '1/1m',
      AUTH_THROTTLE_LOGIN: '1/1m',
      AUTH_THROTTLE_MAIL: '1/1m',
      AUTH_THROTTLE_RESET: '1/1m',
      THROTTLE_LIMIT: '3',
    });
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
    await seedSystemRoles(testApp);
  });

  const verifyEmail = () =>
    request(testApp, 'POST /auth/email/verify', { body: { token: 'not-a-token' } });

  it.each([
    ['POST /auth/register', { email: 'ada@example.com', password: TEST_PASSWORD, name: 'Ada' }],
    ['POST /auth/login', { email: 'ada@example.com', password: TEST_PASSWORD }],
    ['POST /auth/password/forgot', { email: 'ada@example.com' }],
    ['POST /auth/email/resend', { email: 'ada@example.com' }],
    ['POST /auth/password/reset', { token: 'not-a-token', password: TEST_PASSWORD }],
  ] as const)('limit %s with its AUTH_THROTTLE_* setting', async (route, body) => {
    await request(testApp, route, { body });

    const response = await request(testApp, route, { body });

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ statusCode: 429, errorCode: 'RATE_LIMITED' });
  });

  it('limit other routes with THROTTLE_LIMIT', async () => {
    await verifyEmail();
    await verifyEmail();
    await verifyEmail();

    const response = await verifyEmail();

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ errorCode: 'RATE_LIMITED' });
  });
});
