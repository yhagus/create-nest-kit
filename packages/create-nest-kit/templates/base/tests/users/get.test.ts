import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedAdmin, type SignedInUser } from '../support/auth.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

const UNKNOWN_ID = '01900000-0000-7000-8000-000000000000';

describe('GET /users/:id', () => {
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

  it('returns the user, or 404 NOT_FOUND', async () => {
    const found = await request(testApp, `GET /users/${admin.user.id}`, {
      accessToken: admin.accessToken,
    });
    const missing = await request(testApp, `GET /users/${UNKNOWN_ID}`, {
      accessToken: admin.accessToken,
    });

    expect(found.status).toBe(200);
    expect(await found.json()).toMatchObject({
      email: 'admin@example.com',
      roles: [{ name: 'admin' }],
      permissions: expect.arrayContaining(['users:read', 'sessions:revoke']),
    });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ errorCode: 'NOT_FOUND' });
  });

  it('answers 400 BAD_REQUEST without details for an id that is not a UUID', async () => {
    const response = await request(testApp, 'GET /users/not-a-uuid', {
      accessToken: admin.accessToken,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      statusCode: 400,
      errorCode: 'BAD_REQUEST',
      message: expect.any(String),
    });
  });
});
