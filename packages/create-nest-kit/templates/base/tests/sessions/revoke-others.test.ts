import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createSignedInUser,
  expectAccessTokenAccepted,
  expectAccessTokenRefused,
  expectRefreshTokenRefused,
  login,
  seedSystemRoles,
} from '../support/auth.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('DELETE /auth/sessions', () => {
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

  it('signs out every other device at once and keeps the current one', async () => {
    const current = await createSignedInUser(testApp);
    const laptop = await login(testApp, current.user.email);
    const phone = await login(testApp, current.user.email);

    const response = await request(testApp, 'DELETE /auth/sessions', {
      accessToken: current.accessToken,
    });

    expect(response.status).toBe(204);
    await expectAccessTokenRefused(testApp, laptop.accessToken);
    await expectAccessTokenRefused(testApp, phone.accessToken);
    await expectRefreshTokenRefused(testApp, laptop.refreshToken);
    await expectRefreshTokenRefused(testApp, phone.refreshToken);
    const sessions = await request(testApp, 'GET /auth/sessions', {
      accessToken: current.accessToken,
    });
    expect(await sessions.json()).toEqual([expect.objectContaining({ current: true })]);
    await expectAccessTokenAccepted(testApp, current.accessToken);
  });
});
