import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createSignedInUser,
  expectAccessTokenRefused,
  seedAdmin,
  type SignedInUser,
} from '../support/auth.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('DELETE /users/:id', () => {
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

  it('deletes the user and signs them out at once', async () => {
    const grace = await createSignedInUser(testApp, { email: 'grace@example.com' });

    const response = await request(testApp, `DELETE /users/${grace.user.id}`, {
      accessToken: admin.accessToken,
    });

    expect(response.status).toBe(204);
    await expectAccessTokenRefused(testApp, grace.accessToken);
    const lookup = await request(testApp, `GET /users/${grace.user.id}`, {
      accessToken: admin.accessToken,
    });
    expect(lookup.status).toBe(404);
    expect(await lookup.json()).toMatchObject({ errorCode: 'NOT_FOUND' });
  });

  it('answers 409 USER_CANNOT_DELETE_SELF for the admin’s own account', async () => {
    const response = await request(testApp, `DELETE /users/${admin.user.id}`, {
      accessToken: admin.accessToken,
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ errorCode: 'USER_CANNOT_DELETE_SELF' });
  });
});
