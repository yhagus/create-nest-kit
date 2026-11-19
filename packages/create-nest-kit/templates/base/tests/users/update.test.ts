import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createSignedInUser,
  createUser,
  expectAccessTokenAccepted,
  expectAccessTokenRefused,
  login,
  seedAdmin,
  type SignedInUser,
} from '../support/auth.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

const UNKNOWN_ID = '01900000-0000-7000-8000-000000000000';

describe('PATCH /users/:id', () => {
  let testApp: TestApp;
  let admin: SignedInUser;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
    admin = await seedAdmin(testApp);
  });

  it.each(['email', 'name', 'roleIds', 'emailVerified'])(
    'answers 400 VALIDATION_FAILED for a null %s: optional means it may be left out',
    async (field) => {
      const grace = await createUser(testApp, { email: 'grace@example.com' });

      const response = await request(testApp, `PATCH /users/${grace.id}`, {
        accessToken: admin.accessToken,
        body: { [field]: null },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        errorCode: 'VALIDATION_FAILED',
        details: [{ field, errors: expect.any(Array) }],
      });
    },
  );

  it('changes the given fields and keeps the user signed in', async () => {
    const grace = await createSignedInUser(testApp, { email: 'grace@example.com' });

    const response = await request(testApp, `PATCH /users/${grace.user.id}`, {
      accessToken: admin.accessToken,
      body: { name: 'Grace Hopper', email: 'hopper@example.com', emailVerified: false },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      name: 'Grace Hopper',
      email: 'hopper@example.com',
      emailVerified: false,
    });
    await expectAccessTokenAccepted(testApp, grace.accessToken);
  });

  it('answers 409 USER_EMAIL_TAKEN for an email in use', async () => {
    const grace = await createUser(testApp, { email: 'grace@example.com' });

    const response = await request(testApp, `PATCH /users/${grace.id}`, {
      accessToken: admin.accessToken,
      body: { email: 'Admin@example.com' },
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ errorCode: 'USER_EMAIL_TAKEN' });
  });

  it('signs the user out everywhere when their password changes', async () => {
    const grace = await createSignedInUser(testApp, { email: 'grace@example.com' });

    await request(testApp, `PATCH /users/${grace.user.id}`, {
      accessToken: admin.accessToken,
      body: { password: 'a password set by an admin' },
    });

    await expectAccessTokenRefused(testApp, grace.accessToken);
    await login(testApp, 'grace@example.com', 'a password set by an admin');
  });

  it('answers 400 VALIDATION_FAILED for unknown role ids, keeping the user’s roles', async () => {
    const grace = await createUser(testApp, { email: 'grace@example.com' });

    const response = await request(testApp, `PATCH /users/${grace.id}`, {
      accessToken: admin.accessToken,
      body: { roleIds: [UNKNOWN_ID] },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'VALIDATION_FAILED' });
    const lookup = await request(testApp, `GET /users/${grace.id}`, {
      accessToken: admin.accessToken,
    });
    expect(await lookup.json()).toMatchObject({ roles: [{ name: 'user' }] });
  });
});
