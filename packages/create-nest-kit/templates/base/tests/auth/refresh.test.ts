import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createSignedInUser,
  createUser,
  expectAccessTokenRefused,
  expectRefreshTokenRefused,
  refresh,
  seedSystemRoles,
  TEST_PASSWORD,
} from '../support/auth.js';
import { cookieValue, request, setCookieHeader } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

const REFRESH_COOKIE = 'refresh_token';

describe('POST /auth/refresh', () => {
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

  it('rotates the refresh token sent in the body, also setting the new one as the cookie', async () => {
    const { refreshToken } = await createSignedInUser(testApp);

    const response = await request(testApp, 'POST /auth/refresh', { body: { refreshToken } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accessToken: expect.any(String),
      refreshToken: cookieValue(response, REFRESH_COOKIE),
      expiresIn: 900,
      tokenType: 'Bearer',
    });
    expect(cookieValue(response, REFRESH_COOKIE)).not.toBe(refreshToken);
  });

  it('takes the refresh token from the cookie when the body has none', async () => {
    await createUser(testApp);
    const loginResponse = await request(testApp, 'POST /auth/login', {
      body: { email: 'ada@example.com', password: TEST_PASSWORD },
    });

    const response = await request(testApp, 'POST /auth/refresh', {
      headers: { cookie: `${REFRESH_COOKIE}=${cookieValue(loginResponse, REFRESH_COOKIE)}` },
    });

    expect(response.status).toBe(200);
    expect(setCookieHeader(response, REFRESH_COOKIE)).toBeDefined();
  });

  it('answers 401 AUTH_INVALID_REFRESH_TOKEN without a token or with an unknown one', async () => {
    const withoutToken = await request(testApp, 'POST /auth/refresh');
    const withUnknownToken = await request(testApp, 'POST /auth/refresh', {
      body: { refreshToken: 'not-a-refresh-token' },
    });

    expect(withoutToken.status).toBe(401);
    expect(await withoutToken.json()).toMatchObject({ errorCode: 'AUTH_INVALID_REFRESH_TOKEN' });
    expect(withUnknownToken.status).toBe(401);
    expect(await withUnknownToken.json()).toMatchObject({
      errorCode: 'AUTH_INVALID_REFRESH_TOKEN',
    });
  });

  it('answers 400 VALIDATION_FAILED for a null refreshToken: optional means it may be left out', async () => {
    const response = await request(testApp, 'POST /auth/refresh', {
      body: { refreshToken: null },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errorCode: 'VALIDATION_FAILED',
      details: [{ field: 'refreshToken', errors: expect.any(Array) }],
    });
  });

  it('revokes the whole session when a rotated-away token is presented again', async () => {
    const { refreshToken: stolenToken } = await createSignedInUser(testApp);
    const current = await refresh(testApp, stolenToken);

    const reuse = await request(testApp, 'POST /auth/refresh', {
      body: { refreshToken: stolenToken },
    });

    expect(reuse.status).toBe(401);
    expect(await reuse.json()).toMatchObject({ errorCode: 'AUTH_INVALID_REFRESH_TOKEN' });
    await expectAccessTokenRefused(testApp, current.accessToken);
    await expectRefreshTokenRefused(testApp, current.refreshToken);
  });

  it('rotates a token only once when it is sent twice at the same time', async () => {
    const { refreshToken } = await createSignedInUser(testApp);

    const responses = await Promise.all([
      request(testApp, 'POST /auth/refresh', { body: { refreshToken } }),
      request(testApp, 'POST /auth/refresh', { body: { refreshToken } }),
    ]);

    // At most one request rotates the token. The other sees it already rotated away, which is
    // reuse: it revokes the session, so the winner may be refused too if that lands first.
    const statuses = responses.map((response) => response.status).toSorted();
    expect([
      [200, 401],
      [401, 401],
    ]).toContainEqual(statuses);
    await expectRefreshTokenRefused(testApp, refreshToken);
  });
});
