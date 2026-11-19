import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createSignedInUser,
  currentSessionId,
  expectAccessTokenAccepted,
  expectAccessTokenRefused,
  expectRefreshTokenRefused,
  login,
  seedSystemRoles,
} from '../support/auth.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('DELETE /auth/sessions/:id', () => {
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

  it('signs that device out at once', async () => {
    const current = await createSignedInUser(testApp);
    const other = await login(testApp, current.user.email);
    const otherSessionId = await currentSessionId(testApp, other.accessToken);

    const response = await request(testApp, `DELETE /auth/sessions/${otherSessionId}`, {
      accessToken: current.accessToken,
    });

    expect(response.status).toBe(204);
    await expectAccessTokenRefused(testApp, other.accessToken);
    await expectRefreshTokenRefused(testApp, other.refreshToken);
    await expectAccessTokenAccepted(testApp, current.accessToken);
  });

  it('answers 404 for another user’s session and leaves it alone', async () => {
    const ada = await createSignedInUser(testApp);
    const grace = await createSignedInUser(testApp, { email: 'grace@example.com' });
    const graceSessionId = await currentSessionId(testApp, grace.accessToken);

    const response = await request(testApp, `DELETE /auth/sessions/${graceSessionId}`, {
      accessToken: ada.accessToken,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ errorCode: 'NOT_FOUND' });
    await expectAccessTokenAccepted(testApp, grace.accessToken);
  });
});
