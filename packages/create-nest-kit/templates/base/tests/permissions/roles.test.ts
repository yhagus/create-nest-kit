import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSignedInUser, seedAdmin, type SignedInUser } from '../support/auth.js';
import { request } from '../support/http.js';
import { createRole } from '../support/roles.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('permissions granted by roles', () => {
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

  it('are the union of the permissions of every role a user holds', async () => {
    const userReader = await createRole(testApp, admin.accessToken, {
      name: 'user-reader',
      permissions: ['users:read'],
    });
    const roleReader = await createRole(testApp, admin.accessToken, {
      name: 'role-reader',
      permissions: ['roles:read'],
    });
    const { accessToken } = await createSignedInUser(testApp, {
      email: 'grace@example.com',
      roleIds: [userReader, roleReader],
    });

    const users = await request(testApp, 'GET /users', { accessToken });
    const roles = await request(testApp, 'GET /roles', { accessToken });
    const createRoleResponse = await request(testApp, 'POST /roles', {
      accessToken,
      body: { name: 'sneaky', permissions: [] },
    });

    expect(users.status).toBe(200);
    expect(roles.status).toBe(200);
    expect(createRoleResponse.status).toBe(403);
    expect(await createRoleResponse.json()).toMatchObject({ errorCode: 'AUTH_FORBIDDEN' });
  });

  it('change from the next request on when a role’s permissions change', async () => {
    const auditor = await createRole(testApp, admin.accessToken, {
      name: 'auditor',
      permissions: [],
    });
    const { accessToken } = await createSignedInUser(testApp, {
      email: 'grace@example.com',
      roleIds: [auditor],
    });
    const beforeChange = await request(testApp, 'GET /roles', { accessToken });
    expect(beforeChange.status).toBe(403);
    expect(await beforeChange.json()).toMatchObject({ errorCode: 'AUTH_FORBIDDEN' });

    const change = await request(testApp, `PATCH /roles/${auditor}`, {
      accessToken: admin.accessToken,
      body: { permissions: ['roles:read'] },
    });

    expect(change.status).toBe(200);
    expect((await request(testApp, 'GET /roles', { accessToken })).status).toBe(200);
  });
});
