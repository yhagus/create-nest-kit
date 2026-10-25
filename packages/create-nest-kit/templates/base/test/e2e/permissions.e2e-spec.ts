import { Controller, Get, Module } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Permission } from '../../src/modules/permissions/permission.js';
import { RolesService } from '../../src/modules/roles/roles.service.js';
import { createTestApp, type TestApp } from '../support/app.js';
import { createSignedInUser, seedAdmin, seedSystemRoles } from '../support/auth.js';
import { request } from '../support/http.js';

/** A route whose author forgot the access decorator. */
@Controller('probe')
class ProbeController {
  @Get('undecorated')
  undecorated(): { reached: true } {
    return { reached: true };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('permissions', () => {
  let testApp: TestApp;

  async function createRole(name: string, permissions: Permission[]) {
    return testApp.app.get(RolesService).createRole({ name, permissions });
  }

  beforeAll(async () => {
    testApp = await createTestApp({}, { extraImports: [ProbeModule] });
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
    await seedSystemRoles(testApp);
  });

  describe('GET /permissions', () => {
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

  it('grants the union of the permissions of every role a user holds', async () => {
    const userReader = await createRole('user-reader', [Permission.UsersRead]);
    const roleReader = await createRole('role-reader', [Permission.RolesRead]);
    const { accessToken } = await createSignedInUser(testApp, {
      roleIds: [userReader.id, roleReader.id],
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

  it('applies a change to a role’s permissions from the next request on', async () => {
    const auditor = await createRole('auditor', []);
    const { accessToken } = await createSignedInUser(testApp, { roleIds: [auditor.id] });
    const beforeChange = await request(testApp, 'GET /roles', { accessToken });
    expect(beforeChange.status).toBe(403);
    expect(await beforeChange.json()).toMatchObject({ errorCode: 'AUTH_FORBIDDEN' });

    await testApp.app.get(RolesService).updateRole(auditor.id, {
      permissions: [Permission.RolesRead],
    });

    expect((await request(testApp, 'GET /roles', { accessToken })).status).toBe(200);
  });

  describe('a handler without an access decorator', () => {
    it('is refused with 403 even to an admin', async () => {
      const { accessToken } = await seedAdmin(testApp);

      const response = await request(testApp, 'GET /probe/undecorated', { accessToken });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ errorCode: 'AUTH_FORBIDDEN' });
    });

    it('is refused with 401 to anonymous callers', async () => {
      const response = await request(testApp, 'GET /probe/undecorated');

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ errorCode: 'AUTH_UNAUTHENTICATED' });
    });
  });
});
