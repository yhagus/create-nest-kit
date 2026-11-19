import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '../../src/modules/roles/role.js';
import { seedAdmin, seedSystemRoles, type SignedInUser } from '../support/auth.js';
import { request } from '../support/http.js';
import { createRole } from '../support/roles.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('PATCH /roles/:id', () => {
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

  it('answers 400 VALIDATION_FAILED for a null description: optional means it may be left out', async () => {
    const id = await createRole(testApp, admin.accessToken, {
      name: 'support',
      permissions: ['users:read'],
    });

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
    const id = await createRole(testApp, admin.accessToken, {
      name: 'support',
      permissions: ['users:read'],
    });

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
    const id = await createRole(testApp, admin.accessToken, { name: 'support', permissions: [] });
    await createRole(testApp, admin.accessToken, { name: 'helpdesk', permissions: [] });

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

  it('lets a system role keep its name when the unchanged name is sent along', async () => {
    const response = await request(testApp, `PATCH /roles/${systemRoles.user.id}`, {
      accessToken: admin.accessToken,
      body: { name: 'user', description: 'Everyone' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ name: 'user', description: 'Everyone' });
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
