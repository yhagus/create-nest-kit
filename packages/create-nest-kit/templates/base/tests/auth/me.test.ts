import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSignedInUser, seedSystemRoles } from '../support/auth.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('GET and PATCH /auth/me', () => {
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
