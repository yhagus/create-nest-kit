import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, TEST_WEB_ORIGIN, type TestApp } from '../support/app.js';
import { createUser, seedSystemRoles, TEST_PASSWORD } from '../support/auth.js';
import { request } from '../support/http.js';

const CROSS_SITE_HEADERS = { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' };
const LOGIN_BODY = { email: 'ada@example.com', password: TEST_PASSWORD };

describe('security', () => {
  describe('with CSRF protection on', () => {
    let testApp: TestApp;

    beforeAll(async () => {
      testApp = await createTestApp({ CSRF_ENABLED: 'true' });
      await seedSystemRoles(testApp);
      await createUser(testApp);
    });

    afterAll(async () => {
      await testApp.close();
    });

    it('sends security headers and hides X-Powered-By', async () => {
      const response = await fetch(`${testApp.baseUrl}/health`);

      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
      expect(response.headers.has('x-powered-by')).toBe(false);
    });

    it('rejects a cross-site login from a browser with 403', async () => {
      const response = await request(testApp, 'POST /auth/login', {
        body: LOGIN_BODY,
        headers: CROSS_SITE_HEADERS,
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ statusCode: 403, errorCode: 'AUTH_FORBIDDEN' });
    });

    it('lets the configured front end and non-browser clients log in', async () => {
      const fromFrontEnd = await request(testApp, 'POST /auth/login', {
        body: LOGIN_BODY,
        headers: { 'sec-fetch-site': 'same-site', origin: TEST_WEB_ORIGIN },
      });
      const fromServer = await request(testApp, 'POST /auth/login', { body: LOGIN_BODY });

      expect(fromFrontEnd.status).toBe(200);
      expect(fromServer.status).toBe(200);
    });

    it('lets a configured origin send PATCH and DELETE with credentials', async () => {
      const response = await fetch(`${testApp.baseUrl}/api/v1/anything`, {
        method: 'OPTIONS',
        headers: { origin: TEST_WEB_ORIGIN, 'access-control-request-method': 'PATCH' },
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe(TEST_WEB_ORIGIN);
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
      expect(response.headers.get('access-control-allow-methods')).toContain('PATCH');
      expect(response.headers.get('access-control-allow-methods')).toContain('DELETE');
    });

    it('answers a malformed JSON body with 400 BAD_REQUEST', async () => {
      const response = await fetch(`${testApp.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"email": ',
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        statusCode: 400,
        errorCode: 'BAD_REQUEST',
        message: expect.any(String),
      });
    });

    it('answers an unknown route with the error body', async () => {
      const response = await fetch(`${testApp.baseUrl}/api/v1/does-not-exist`);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        statusCode: 404,
        errorCode: 'NOT_FOUND',
        message: expect.any(String),
      });
    });
  });

  describe('with CSRF protection off', () => {
    let testApp: TestApp;

    beforeAll(async () => {
      testApp = await createTestApp({ CSRF_ENABLED: 'false' });
      await seedSystemRoles(testApp);
      await createUser(testApp);
    });

    afterAll(async () => {
      await testApp.close();
    });

    it('lets a cross-site login through', async () => {
      const response = await request(testApp, 'POST /auth/login', {
        body: LOGIN_BODY,
        headers: CROSS_SITE_HEADERS,
      });

      expect(response.status).toBe(200);
    });
  });

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
      ['POST /auth/login', LOGIN_BODY],
      ['POST /auth/password/forgot', { email: 'ada@example.com' }],
      ['POST /auth/email/resend', { email: 'ada@example.com' }],
      ['POST /auth/password/reset', { token: 'not-a-token', password: TEST_PASSWORD }],
    ] as const)('limits %s with its AUTH_THROTTLE_* setting', async (route, body) => {
      await request(testApp, route, { body });

      const response = await request(testApp, route, { body });

      expect(response.status).toBe(429);
      expect(await response.json()).toMatchObject({ statusCode: 429, errorCode: 'RATE_LIMITED' });
    });

    it('limits other routes with THROTTLE_LIMIT', async () => {
      await verifyEmail();
      await verifyEmail();
      await verifyEmail();

      const response = await verifyEmail();

      expect(response.status).toBe(429);
      expect(await response.json()).toMatchObject({ errorCode: 'RATE_LIMITED' });
    });
  });
});
