import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createUser, seedSystemRoles, TEST_PASSWORD } from '../support/auth.js';
import { request, setCookieHeader } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

const REFRESH_COOKIE = 'refresh_token';
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;
const MAX_AGE_PREFIX = 'Max-Age=';
/** Max-Age counts down from the session's expiry, so it may be a few seconds short. */
const MAX_AGE_TOLERANCE_SECONDS = 5;

async function loginAttributes(testApp: TestApp): Promise<string[]> {
  await createUser(testApp);
  const response = await request(testApp, 'POST /auth/login', {
    body: { email: 'ada@example.com', password: TEST_PASSWORD },
  });
  expect(response.status).toBe(200);
  return setCookieHeader(response, REFRESH_COOKIE)?.split('; ').slice(1) ?? [];
}

describe('the refresh cookie', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
    await seedSystemRoles(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('is HttpOnly, SameSite=Strict, scoped to /api/v1/auth, for the refresh lifetime', async () => {
    const attributes = await loginAttributes(testApp);

    expect(attributes).toEqual(
      expect.arrayContaining(['HttpOnly', 'SameSite=Strict', 'Path=/api/v1/auth']),
    );
    const maxAge = Number(
      attributes
        .find((attribute) => attribute.startsWith(MAX_AGE_PREFIX))
        ?.slice(MAX_AGE_PREFIX.length),
    );
    expect(maxAge).toBeGreaterThanOrEqual(THIRTY_DAYS_IN_SECONDS - MAX_AGE_TOLERANCE_SECONDS);
    expect(maxAge).toBeLessThanOrEqual(THIRTY_DAYS_IN_SECONDS);
    // NODE_ENV=test serves plain http, so the cookie can't be Secure.
    expect(attributes).not.toContain('Secure');
  });
});

describe('the refresh cookie in production', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ NODE_ENV: 'production' });
    await seedSystemRoles(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('is Secure', async () => {
    const attributes = await loginAttributes(testApp);

    expect(attributes).toContain('Secure');
  });
});
