import { afterEach, describe, expect, it } from 'vitest';
import { createUser, login, seedSystemRoles } from '../support/auth.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

const PROXY_HEADERS = { 'x-forwarded-for': '203.0.113.9' };

/** The caller's sessions after signing in through a proxy that sent X-Forwarded-For. */
async function sessionsAfterLoginThroughProxy(testApp: TestApp): Promise<unknown> {
  await seedSystemRoles(testApp);
  await createUser(testApp);
  const { accessToken } = await login(testApp, 'ada@example.com', undefined, PROXY_HEADERS);
  const response = await request(testApp, 'GET /auth/sessions', { accessToken });
  return response.json();
}

describe('the client ip of a session', () => {
  let testApp: TestApp | undefined;

  afterEach(async () => {
    await testApp?.close();
  });

  it('comes from X-Forwarded-For when TRUST_PROXY is on', async () => {
    testApp = await createTestApp({ TRUST_PROXY: 'true' });

    const sessions = await sessionsAfterLoginThroughProxy(testApp);

    expect(sessions).toEqual([expect.objectContaining({ ip: '203.0.113.9' })]);
  });

  it('ignores X-Forwarded-For when TRUST_PROXY is off', async () => {
    testApp = await createTestApp({ TRUST_PROXY: 'false' });

    const sessions = await sessionsAfterLoginThroughProxy(testApp);

    expect(sessions).toEqual([
      expect.objectContaining({ ip: expect.not.stringContaining('203.0.113.9') }),
    ]);
  });
});
