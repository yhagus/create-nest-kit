import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../support/test-app.js';
import { TEST_WEB_ORIGIN } from '../support/test-env.js';

const ADMIN_ORIGIN = 'http://admin.localhost:5174';

function preflight(testApp: TestApp, origin: string): Promise<Response> {
  return fetch(`${testApp.baseUrl}/api/v1/anything`, {
    method: 'OPTIONS',
    headers: { origin, 'access-control-request-method': 'PATCH' },
  });
}

describe('CORS', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    // A list as people write it: spaces after the commas and a trailing comma.
    testApp = await createTestApp({ CORS_ORIGINS: `${TEST_WEB_ORIGIN}, ${ADMIN_ORIGIN},` });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('lets a configured origin send PATCH and DELETE with credentials', async () => {
    const response = await preflight(testApp, TEST_WEB_ORIGIN);

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(TEST_WEB_ORIGIN);
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    expect(response.headers.get('access-control-allow-methods')).toContain('PATCH');
    expect(response.headers.get('access-control-allow-methods')).toContain('DELETE');
  });

  it('trusts every origin in CORS_ORIGINS, and only those', async () => {
    const fromAdmin = await preflight(testApp, ADMIN_ORIGIN);
    const fromElsewhere = await preflight(testApp, 'https://evil.example');

    expect(fromAdmin.headers.get('access-control-allow-origin')).toBe(ADMIN_ORIGIN);
    expect(fromElsewhere.headers.get('access-control-allow-origin')).toBeNull();
  });
});
