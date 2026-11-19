import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createUser, login, seedSystemRoles } from '../support/auth.js';
import { request } from '../support/http.js';
import { isRecord } from '../support/json.js';
import { runPackageScript, type ScriptOutput } from '../support/package-script.js';
import { createTestApp, type TestApp } from '../support/test-app.js';
import { TEST_ENV } from '../support/test-env.js';

const ADMIN_EMAIL = 'root@example.com';
const ADMIN_PASSWORD = 'a seeded admin password';
/** `db:seed` builds the project with the Nest CLI before it runs. */
const SEED_TEST_TIMEOUT_MS = 180_000;

function runSeed(): Promise<ScriptOutput> {
  return runPackageScript('db:seed', {
    ...TEST_ENV,
    ...inject('containerEnv'),
    SEED_ADMIN_EMAIL: ADMIN_EMAIL,
    SEED_ADMIN_PASSWORD: ADMIN_PASSWORD,
  });
}

/** Every role and the permissions that exist, read by the seeded admin. */
async function readRoles(testApp: TestApp, accessToken: string) {
  const roles = await request(testApp, 'GET /roles', { accessToken });
  const permissions = await request(testApp, 'GET /permissions', { accessToken });
  expect(roles.status).toBe(200);
  return { roles: await roles.json(), allPermissions: await permissions.json() };
}

describe('db:seed', { timeout: SEED_TEST_TIMEOUT_MS }, () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
  });

  it('creates the system roles and a verified admin from SEED_ADMIN_*', async () => {
    const { stdout } = await runSeed();

    expect(stdout).toContain(`Created the admin ${ADMIN_EMAIL}`);
    const { accessToken } = await login(testApp, ADMIN_EMAIL, ADMIN_PASSWORD);
    const me = await request(testApp, 'GET /auth/me', { accessToken });
    expect(await me.json()).toMatchObject({ emailVerified: true, roles: [{ name: 'admin' }] });
    const { roles, allPermissions } = await readRoles(testApp, accessToken);
    expect(roles).toMatchObject([
      { name: 'admin', permissions: allPermissions, isSystem: true },
      { name: 'user', permissions: [], isSystem: true },
    ]);
  });

  it('keeps the admin’s password and the user role’s permissions when run again', async () => {
    await runSeed();
    const admin = await login(testApp, ADMIN_EMAIL, ADMIN_PASSWORD);
    const { roles: rolesAfterFirstRun } = await readRoles(testApp, admin.accessToken);
    const userRoleId = userRoleIdIn(rolesAfterFirstRun);
    await request(testApp, `PATCH /roles/${userRoleId}`, {
      accessToken: admin.accessToken,
      body: { permissions: ['roles:read'] },
    });
    await request(testApp, 'POST /auth/password/change', {
      accessToken: admin.accessToken,
      body: { currentPassword: ADMIN_PASSWORD, newPassword: 'a password the admin chose' },
    });

    const { stdout } = await runSeed();

    expect(stdout).toContain(
      `Updated the existing admin ${ADMIN_EMAIL}; its password is unchanged`,
    );
    const { accessToken } = await login(testApp, ADMIN_EMAIL, 'a password the admin chose');
    const { roles } = await readRoles(testApp, accessToken);
    expect(roles).toMatchObject([
      { name: 'admin', isSystem: true },
      { id: userRoleId, name: 'user', permissions: ['roles:read'], isSystem: true },
    ]);
  });

  it('makes an existing user with the admin email the admin, verifying the email', async () => {
    await seedSystemRoles(testApp);
    await createUser(testApp, {
      email: ADMIN_EMAIL,
      password: 'the user’s own password',
      emailVerified: false,
    });

    await runSeed();

    const { accessToken } = await login(testApp, ADMIN_EMAIL, 'the user’s own password');
    const me = await request(testApp, 'GET /auth/me', { accessToken });
    expect(await me.json()).toMatchObject({
      emailVerified: true,
      roles: expect.arrayContaining([expect.objectContaining({ name: 'admin' })]),
    });
  });
});

/** The id of the `user` role in a `GET /roles` body. */
function userRoleIdIn(roles: unknown): string {
  const userRole: unknown = Array.isArray(roles)
    ? roles.find((role: unknown) => isRecord(role) && role['name'] === 'user')
    : undefined;
  const id = isRecord(userRole) ? userRole['id'] : undefined;
  if (typeof id !== 'string') throw new Error('The seed created no user role');
  return id;
}
