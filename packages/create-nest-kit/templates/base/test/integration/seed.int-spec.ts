import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS } from '../../src/modules/permissions/permission.js';
import { RolesService } from '../../src/modules/roles/roles.service.js';
import { UsersService } from '../../src/modules/users/users.service.js';
import { seedDatabase } from '../../src/seed/seed.js';
import { createTestApp, type TestApp } from '../support/app.js';
import { login } from '../support/auth.js';

const ADMIN_EMAIL = 'root@example.com';
const ADMIN_PASSWORD = 'a seeded admin password';

describe('seedDatabase', () => {
  let testApp: TestApp;

  /** What the seed is responsible for, without timestamps that a re-sync may move. */
  async function seededState() {
    const roles = await testApp.app.get(RolesService).listRoles();
    const users = await testApp.app.get(UsersService).listUsers({ page: 1, limit: 100 });
    return {
      roles: roles.map(({ id, name, permissions, isSystem }) => ({
        id,
        name,
        permissions,
        isSystem,
      })),
      users: users.items.map(({ id, email, emailVerifiedAt, roles: userRoles }) => ({
        id,
        email,
        isEmailVerified: emailVerifiedAt !== null,
        roleNames: userRoles.map((role) => role.name),
      })),
    };
  }

  beforeAll(async () => {
    testApp = await createTestApp({
      SEED_ADMIN_EMAIL: ADMIN_EMAIL,
      SEED_ADMIN_PASSWORD: ADMIN_PASSWORD,
    });
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
  });

  it('creates the system roles and a verified admin from SEED_ADMIN_*', async () => {
    const report = await seedDatabase(testApp.app);

    expect(report).toEqual({ adminEmail: ADMIN_EMAIL, adminCreated: true });
    expect(await seededState()).toEqual({
      roles: [
        { id: expect.any(String), name: 'admin', permissions: ALL_PERMISSIONS, isSystem: true },
        { id: expect.any(String), name: 'user', permissions: [], isSystem: true },
      ],
      users: [
        { id: expect.any(String), email: ADMIN_EMAIL, isEmailVerified: true, roleNames: ['admin'] },
      ],
    });
    await login(testApp, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  it('changes nothing when run again', async () => {
    await seedDatabase(testApp.app);
    const afterFirstRun = await seededState();

    const report = await seedDatabase(testApp.app);

    expect(report).toEqual({ adminEmail: ADMIN_EMAIL, adminCreated: false });
    expect(await seededState()).toEqual(afterFirstRun);
    await login(testApp, ADMIN_EMAIL, ADMIN_PASSWORD);
  });
});
