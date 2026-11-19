import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSignedInUser, seedAdmin, seedSystemRoles } from '../support/auth.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('GET /permissions', () => {
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

  it('lists every permission to holders of roles:read', async () => {
    const { accessToken } = await seedAdmin(testApp);

    const response = await request(testApp, 'GET /permissions', { accessToken });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      'users:read',
      'users:create',
      'users:update',
      'users:delete',
      'roles:read',
      'roles:create',
      'roles:update',
      'roles:delete',
      'sessions:read',
      'sessions:revoke',
    ]);
  });

  it('answers 401 to anonymous callers and 403 to users without roles:read', async () => {
    const { accessToken } = await createSignedInUser(testApp);

    const anonymous = await request(testApp, 'GET /permissions');
    const withoutPermission = await request(testApp, 'GET /permissions', { accessToken });

    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toMatchObject({ errorCode: 'AUTH_UNAUTHENTICATED' });
    expect(withoutPermission.status).toBe(403);
    expect(await withoutPermission.json()).toEqual({
      statusCode: 403,
      errorCode: 'AUTH_FORBIDDEN',
      message: expect.any(String),
    });
  });
});
