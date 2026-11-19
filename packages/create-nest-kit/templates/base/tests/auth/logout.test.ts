import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createSignedInUser,
  expectAccessTokenRefused,
  expectRefreshTokenRefused,
  seedSystemRoles,
} from '../support/auth.js';
import { cookieValue, request, setCookieHeader } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

const REFRESH_COOKIE = 'refresh_token';

describe('POST /auth/logout', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
    await seedSystemRoles(testApp);
  });

  it('revokes the session at once and clears the cookie', async () => {
    const { accessToken, refreshToken } = await createSignedInUser(testApp);

    const response = await request(testApp, 'POST /auth/logout', { accessToken });

    expect(response.status).toBe(204);
    expect(setCookieHeader(response, REFRESH_COOKIE)).toMatch(/Path=\/api\/v1\/auth/);
    expect(cookieValue(response, REFRESH_COOKIE)).toBe('');
    await expectAccessTokenRefused(testApp, accessToken);
    await expectRefreshTokenRefused(testApp, refreshToken);
  });

  it('answers 401 AUTH_UNAUTHENTICATED without an access token', async () => {
    const response = await request(testApp, 'POST /auth/logout');

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_UNAUTHENTICATED' });
  });
});
