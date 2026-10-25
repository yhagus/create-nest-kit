import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  decodeAccessToken,
  signAccessToken,
  unsignedAccessToken,
} from '../support/access-token.js';
import { createTestApp, type TestApp } from '../support/app.js';
import {
  createSignedInUser,
  createUser,
  currentSessionId,
  expectAccessTokenAccepted,
  expectAccessTokenRefused,
  expectRefreshTokenRefused,
  refresh,
  seedSystemRoles,
  TEST_PASSWORD,
} from '../support/auth.js';
import { ISO_TIMESTAMP, UUID_V7 } from '../support/formats.js';
import { cookieValue, request, setCookieHeader } from '../support/http.js';

const REFRESH_COOKIE = 'refresh_token';
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;
const MAX_AGE_PREFIX = 'Max-Age=';
/** Max-Age counts down from the session's expiry, so it may be a few seconds short. */
const MAX_AGE_TOLERANCE_SECONDS = 5;
/** The default ACCESS_TOKEN_TTL, 15m. */
const FIFTEEN_MINUTES_IN_SECONDS = 15 * 60;
const PASSWORD_MAX_LENGTH = 128;

describe('auth', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ EMAIL_VERIFICATION_ENABLED: 'false' });
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
    await seedSystemRoles(testApp);
  });

  describe('POST /auth/register', () => {
    it('creates a user with the user role and no permissions', async () => {
      const response = await request(testApp, 'POST /auth/register', {
        body: { email: ' Ada@Example.com ', password: TEST_PASSWORD, name: ' Ada Lovelace ' },
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({
        id: expect.stringMatching(UUID_V7),
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        emailVerified: false,
        roles: [{ id: expect.stringMatching(UUID_V7), name: 'user' }],
        permissions: [],
        createdAt: expect.stringMatching(ISO_TIMESTAMP),
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      });
    });

    it('answers 409 USER_EMAIL_TAKEN for an email in use, in any case', async () => {
      await createUser(testApp, { email: 'ada@example.com' });

      const response = await request(testApp, 'POST /auth/register', {
        body: { email: 'ADA@example.com', password: TEST_PASSWORD, name: 'Ada' },
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ errorCode: 'USER_EMAIL_TAKEN' });
    });

    it('answers 400 VALIDATION_FAILED listing the invalid fields', async () => {
      const response = await request(testApp, 'POST /auth/register', {
        body: { email: 'not-an-email', password: 'short', name: 'Ada' },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        errorCode: 'VALIDATION_FAILED',
        details: [
          { field: 'email', errors: expect.any(Array) },
          { field: 'password', errors: expect.any(Array) },
        ],
      });
    });

    it('refuses unknown properties, naming them', async () => {
      const response = await request(testApp, 'POST /auth/register', {
        body: { email: 'ada@example.com', password: TEST_PASSWORD, name: 'Ada', isAdmin: true },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        errorCode: 'VALIDATION_FAILED',
        details: [{ field: 'isAdmin', errors: expect.any(Array) }],
      });
    });

    it('refuses a password longer than 128 characters', async () => {
      const response = await request(testApp, 'POST /auth/register', {
        body: {
          email: 'ada@example.com',
          password: 'a'.repeat(PASSWORD_MAX_LENGTH + 1),
          name: 'Ada',
        },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        errorCode: 'VALIDATION_FAILED',
        details: [{ field: 'password', errors: expect.any(Array) }],
      });
    });
  });

  describe('POST /auth/login', () => {
    it('returns a token pair and the user, and sets the refresh cookie', async () => {
      const user = await createUser(testApp);

      const response = await request(testApp, 'POST /auth/login', {
        body: { email: 'ADA@example.com', password: TEST_PASSWORD },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        accessToken: expect.any(String),
        refreshToken: cookieValue(response, REFRESH_COOKIE),
        expiresIn: 900,
        tokenType: 'Bearer',
        user: expect.objectContaining({ id: user.id, email: 'ada@example.com' }),
      });
    });

    it('sets the refresh cookie HttpOnly, SameSite=Strict, scoped to /api/v1/auth, for the refresh lifetime', async () => {
      await createUser(testApp);

      const response = await request(testApp, 'POST /auth/login', {
        body: { email: 'ada@example.com', password: TEST_PASSWORD },
      });

      const attributes = setCookieHeader(response, REFRESH_COOKIE)?.split('; ').slice(1) ?? [];
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

    it('answers 401 AUTH_INVALID_CREDENTIALS alike for a wrong password and an unknown email', async () => {
      await createUser(testApp);

      const wrongPassword = await request(testApp, 'POST /auth/login', {
        body: { email: 'ada@example.com', password: 'wrong password' },
      });
      const unknownEmail = await request(testApp, 'POST /auth/login', {
        body: { email: 'nobody@example.com', password: TEST_PASSWORD },
      });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      const wrongPasswordBody = await wrongPassword.json();
      expect(wrongPasswordBody).toMatchObject({ errorCode: 'AUTH_INVALID_CREDENTIALS' });
      expect(await unknownEmail.json()).toEqual(wrongPasswordBody);
    });
  });

  describe('access tokens', () => {
    const OTHER_SECRET = 'another-jwt-secret-of-at-least-32-characters';

    it('carry the user, the current session and the access token lifetime', async () => {
      const { user, accessToken } = await createSignedInUser(testApp);

      const claims = decodeAccessToken(accessToken);

      expect(claims.sub).toBe(user.id);
      expect(claims.sid).toBe(await currentSessionId(testApp, accessToken));
      expect(claims.exp - claims.iat).toBe(FIFTEEN_MINUTES_IN_SECONDS);
    });

    it('are refused when signed with another secret', async () => {
      const { accessToken } = await createSignedInUser(testApp);

      const forged = signAccessToken(decodeAccessToken(accessToken), OTHER_SECRET);

      await expectAccessTokenRefused(testApp, forged);
    });

    it('are refused unsigned (alg none)', async () => {
      const { accessToken } = await createSignedInUser(testApp);

      const forged = unsignedAccessToken(decodeAccessToken(accessToken));

      await expectAccessTokenRefused(testApp, forged);
    });
  });

  describe('POST /auth/refresh', () => {
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
  });

  describe('POST /auth/logout', () => {
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

  describe('GET and PATCH /auth/me', () => {
    it('returns the signed-in user', async () => {
      const { user, accessToken } = await createSignedInUser(testApp);

      const response = await request(testApp, 'GET /auth/me', { accessToken });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        id: user.id,
        email: 'ada@example.com',
        emailVerified: true,
        roles: [{ name: 'user' }],
      });
    });

    it('answers 401 for an invalid access token', async () => {
      const response = await request(testApp, 'GET /auth/me', { accessToken: 'not.a.jwt' });

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ errorCode: 'AUTH_UNAUTHENTICATED' });
    });

    it('changes the name', async () => {
      const { accessToken } = await createSignedInUser(testApp);

      const response = await request(testApp, 'PATCH /auth/me', {
        accessToken,
        body: { name: 'Ada King' },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ name: 'Ada King' });
    });

    it('refuses to change anything but the name', async () => {
      const { accessToken } = await createSignedInUser(testApp);

      const response = await request(testApp, 'PATCH /auth/me', {
        accessToken,
        body: { name: 'Ada', email: 'other@example.com' },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ errorCode: 'VALIDATION_FAILED' });
    });
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
    await createUser(testApp);

    const response = await request(testApp, 'POST /auth/login', {
      body: { email: 'ada@example.com', password: TEST_PASSWORD },
    });

    expect(response.status).toBe(200);
    expect(setCookieHeader(response, REFRESH_COOKIE)?.split('; ')).toContain('Secure');
  });
});

// Each wait leaves at least 1.5 s between a refresh and the deadline it must beat, and passes a
// deadline by at least a second, so a slow machine can't turn these red.
describe('auth token lifetimes', () => {
  // JWT expiry has a resolution of one second, so waits are a little over two.
  const PAST_TWO_SECONDS_MS = 2_100;
  const LIFETIME_TEST_TIMEOUT_MS = 20_000;

  describe('with a one-second access token', () => {
    let testApp: TestApp;

    beforeAll(async () => {
      testApp = await createTestApp({ ACCESS_TOKEN_TTL: '1s' });
      await seedSystemRoles(testApp);
    });

    afterAll(async () => {
      await testApp.close();
    });

    it('rejects the access token once it expires, while refresh still works', async () => {
      const { accessToken, refreshToken } = await createSignedInUser(testApp);

      await sleep(PAST_TWO_SECONDS_MS);

      await expectAccessTokenRefused(testApp, accessToken);
      const renewed = await refresh(testApp, refreshToken);
      await expectAccessTokenAccepted(testApp, renewed.accessToken);
    });
  });

  describe('with a four-second sliding refresh lifetime', () => {
    const WITHIN_LIFETIME_MS = 2_500;
    const PAST_LIFETIME_MS = 5_000;
    let testApp: TestApp;

    beforeAll(async () => {
      testApp = await createTestApp({ REFRESH_TOKEN_TTL: '4s' });
      await seedSystemRoles(testApp);
    });

    afterAll(async () => {
      await testApp.close();
    });

    it(
      'extends the session on each refresh and ends it when unused for longer',
      async () => {
        const { refreshToken } = await createSignedInUser(testApp);

        await sleep(WITHIN_LIFETIME_MS);
        const renewed = await refresh(testApp, refreshToken);
        // Past the login's original expiry, so this refresh works only if the first one extended it.
        await sleep(WITHIN_LIFETIME_MS);
        const renewedAgain = await refresh(testApp, renewed.refreshToken);
        await sleep(PAST_LIFETIME_MS);

        await expectRefreshTokenRefused(testApp, renewedAgain.refreshToken);
      },
      LIFETIME_TEST_TIMEOUT_MS,
    );
  });

  describe('with a three-second absolute session lifetime', () => {
    const WITHIN_LIFETIME_MS = 1_500;
    const PAST_LIFETIME_MS = 2_500;
    let testApp: TestApp;

    beforeAll(async () => {
      testApp = await createTestApp({ SESSION_ABSOLUTE_TTL: '3s' });
      await seedSystemRoles(testApp);
    });

    afterAll(async () => {
      await testApp.close();
    });

    it(
      'ends the session at its absolute expiry however often it is refreshed',
      async () => {
        const { refreshToken } = await createSignedInUser(testApp);

        await sleep(WITHIN_LIFETIME_MS);
        const renewed = await refresh(testApp, refreshToken);
        await sleep(PAST_LIFETIME_MS);

        await expectRefreshTokenRefused(testApp, renewed.refreshToken);
      },
      LIFETIME_TEST_TIMEOUT_MS,
    );
  });
});
