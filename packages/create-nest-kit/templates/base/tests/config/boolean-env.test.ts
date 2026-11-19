import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createUser, seedSystemRoles, TEST_PASSWORD } from '../support/auth.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('boolean settings', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ SWAGGER_ENABLED: 'yes', CSRF_ENABLED: 'off' });
    await seedSystemRoles(testApp);
    await createUser(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('read yes as on and off as off', async () => {
    const docs = await fetch(`${testApp.baseUrl}/docs`);
    const crossSiteLogin = await request(testApp, 'POST /auth/login', {
      body: { email: 'ada@example.com', password: TEST_PASSWORD },
      headers: { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' },
    });

    expect(docs.status).toBe(200);
    expect(crossSiteLogin.status).toBe(200);
  });
});
