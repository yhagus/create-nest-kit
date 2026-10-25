import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '../../src/modules/roles/role.js';
import { createTestApp, type TestApp } from '../support/app.js';
import { createUser, seedAdmin, seedSystemRoles, type SignedInUser } from '../support/auth.js';
import { ISO_TIMESTAMP, UUID_V7 } from '../support/formats.js';
import { request } from '../support/http.js';
import { expectShape, isRecord } from '../support/json.js';

const UNKNOWN_ID = '01900000-0000-7000-8000-000000000000';

function hasId(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value['id'] === 'string';
}

describe('roles', () => {
  let testApp: TestApp;
  let admin: SignedInUser;
  let systemRoles: { admin: Role; user: Role };

  async function createRole(body: Record<string, unknown>): Promise<string> {
    const response = await request(testApp, 'POST /roles', {
      accessToken: admin.accessToken,
      body,
    });
    expect(response.status).toBe(201);
    return expectShape(await response.json(), hasId, 'a role').id;
  }

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

  describe('GET /roles', () => {
    it('lists every role by name', async () => {
      await createRole({ name: 'support', permissions: ['users:read'] });

      const response = await request(testApp, 'GET /roles', { accessToken: admin.accessToken });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject([
        { name: 'admin', isSystem: true },
        { name: 'support', isSystem: false },
        { name: 'user', isSystem: true, permissions: [] },
      ]);
    });
  });

  describe('GET /roles/:id', () => {
    it('returns the role, or 404 NOT_FOUND', async () => {
      const found = await request(testApp, `GET /roles/${systemRoles.user.id}`, {
        accessToken: admin.accessToken,
      });
      const missing = await request(testApp, `GET /roles/${UNKNOWN_ID}`, {
        accessToken: admin.accessToken,
      });

      expect(found.status).toBe(200);
      expect(await found.json()).toEqual({
        id: systemRoles.user.id,
        name: 'user',
        description: expect.any(String),
        permissions: [],
        isSystem: true,
        createdAt: expect.stringMatching(ISO_TIMESTAMP),
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      });
      expect(missing.status).toBe(404);
      expect(await missing.json()).toMatchObject({ errorCode: 'NOT_FOUND' });
    });
  });

  describe('POST /roles', () => {
    it('creates a custom role', async () => {
      const response = await request(testApp, 'POST /roles', {
        accessToken: admin.accessToken,
        body: { name: 'support', description: 'Helps users', permissions: ['users:read'] },
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        id: expect.stringMatching(UUID_V7),
        name: 'support',
        description: 'Helps users',
        permissions: ['users:read'],
        isSystem: false,
      });
    });

    it('answers 409 ROLE_NAME_TAKEN for a name in use', async () => {
      const response = await request(testApp, 'POST /roles', {
        accessToken: admin.accessToken,
        body: { name: 'user', permissions: [] },
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ errorCode: 'ROLE_NAME_TAKEN' });
    });

    it('answers 400 VALIDATION_FAILED for an unknown permission or a malformed name', async () => {
      const response = await request(testApp, 'POST /roles', {
        accessToken: admin.accessToken,
        body: { name: 'Support Team', permissions: ['users:fly'] },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        errorCode: 'VALIDATION_FAILED',
        details: [
          { field: 'name', errors: expect.any(Array) },
          { field: 'permissions', errors: expect.any(Array) },
        ],
      });
    });
  });

  describe('PATCH /roles/:id', () => {
    it('answers 400 VALIDATION_FAILED for a null description: optional means it may be left out', async () => {
      const id = await createRole({ name: 'support', permissions: ['users:read'] });

      const response = await request(testApp, `PATCH /roles/${id}`, {
        accessToken: admin.accessToken,
        body: { description: null },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        errorCode: 'VALIDATION_FAILED',
        details: [{ field: 'description', errors: expect.any(Array) }],
      });
    });

    it('changes a custom role', async () => {
      const id = await createRole({ name: 'support', permissions: ['users:read'] });

      const response = await request(testApp, `PATCH /roles/${id}`, {
        accessToken: admin.accessToken,
        body: { name: 'helpdesk', permissions: ['users:read', 'sessions:read'] },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        name: 'helpdesk',
        permissions: ['users:read', 'sessions:read'],
      });
    });

    it('answers 409 ROLE_NAME_TAKEN for renaming to a name in use', async () => {
      const id = await createRole({ name: 'support', permissions: [] });
      await createRole({ name: 'helpdesk', permissions: [] });

      const response = await request(testApp, `PATCH /roles/${id}`, {
        accessToken: admin.accessToken,
        body: { name: 'helpdesk' },
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ errorCode: 'ROLE_NAME_TAKEN' });
    });

    it('changes the description and permissions of the user role', async () => {
      const response = await request(testApp, `PATCH /roles/${systemRoles.user.id}`, {
        accessToken: admin.accessToken,
        body: { description: 'Everyone', permissions: ['roles:read'] },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        description: 'Everyone',
        permissions: ['roles:read'],
      });
    });

    it('answers 409 ROLE_PROTECTED for renaming a system role', async () => {
      const response = await request(testApp, `PATCH /roles/${systemRoles.user.id}`, {
        accessToken: admin.accessToken,
        body: { name: 'member' },
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ errorCode: 'ROLE_PROTECTED' });
    });

    it('answers 409 ROLE_PROTECTED for taking a permission from admin', async () => {
      const response = await request(testApp, `PATCH /roles/${systemRoles.admin.id}`, {
        accessToken: admin.accessToken,
        body: { permissions: ['users:read'] },
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ errorCode: 'ROLE_PROTECTED' });
    });
  });

  describe('DELETE /roles/:id', () => {
    it('deletes a custom role and takes it away from its users', async () => {
      const supportId = await createRole({ name: 'support', permissions: ['users:read'] });
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
});
