import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '../../src/modules/roles/role.js';
import { seedAdmin, seedSystemRoles, type SignedInUser } from '../support/auth.js';
import { ISO_TIMESTAMP } from '../support/formats.js';
import { request } from '../support/http.js';
import { createRole } from '../support/roles.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

const UNKNOWN_ID = '01900000-0000-7000-8000-000000000000';

describe('GET /roles and /roles/:id', () => {
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

  it('lists every role by name', async () => {
    await createRole(testApp, admin.accessToken, { name: 'support', permissions: ['users:read'] });

    const response = await request(testApp, 'GET /roles', { accessToken: admin.accessToken });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject([
      { name: 'admin', isSystem: true },
      { name: 'support', isSystem: false },
      { name: 'user', isSystem: true, permissions: [] },
    ]);
  });

  it('returns one role, or 404 NOT_FOUND', async () => {
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
