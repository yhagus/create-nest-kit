import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createUser, seedSystemRoles, TEST_PASSWORD } from '../support/auth.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';
import { TEST_WEB_ORIGIN } from '../support/test-env.js';

const CROSS_SITE_HEADERS = { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' };
const LOGIN_BODY = { email: 'ada@example.com', password: TEST_PASSWORD };

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
