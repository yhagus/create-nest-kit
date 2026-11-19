import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '../../src/modules/roles/role.js';
import { createUser, seedAdmin, seedSystemRoles, type SignedInUser } from '../support/auth.js';
import { request } from '../support/http.js';
import { createRole } from '../support/roles.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('DELETE /roles/:id', () => {
  let testApp: TestApp;
  let admin: SignedInUser;
  let systemRoles: { admin: Role; user: Role };

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
    admin = await seedAdmin(testApp);
    systemRoles = await seedSystemRoles(testApp);
  });

  it('deletes a custom role and takes it away from its users', async () => {
    const supportId = await createRole(testApp, admin.accessToken, {
      name: 'support',
      permissions: ['users:read'],
    });
    const grace = await createUser(testApp, {
      email: 'grace@example.com',
      roleIds: [systemRoles.user.id, supportId],
    });

    const response = await request(testApp, `DELETE /roles/${supportId}`, {
      accessToken: admin.accessToken,
    });

    expect(response.status).toBe(204);
    const user = await request(testApp, `GET /users/${grace.id}`, {
      accessToken: admin.accessToken,
    });
    expect(await user.json()).toMatchObject({ roles: [{ name: 'user' }], permissions: [] });
  });

  it('answers 409 ROLE_PROTECTED for a system role and keeps it', async () => {
    const response = await request(testApp, `DELETE /roles/${systemRoles.user.id}`, {
      accessToken: admin.accessToken,
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ errorCode: 'ROLE_PROTECTED' });
    const lookup = await request(testApp, `GET /roles/${systemRoles.user.id}`, {
      accessToken: admin.accessToken,
    });
    expect(lookup.status).toBe(200);
  });
});
