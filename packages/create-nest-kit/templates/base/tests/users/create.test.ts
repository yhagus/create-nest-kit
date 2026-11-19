import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { findRole, login, seedAdmin, type SignedInUser, TEST_PASSWORD } from '../support/auth.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

const UNKNOWN_ID = '01900000-0000-7000-8000-000000000000';

describe('POST /users', () => {
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

  it('creates a user with roles and a verified email, who can sign in', async () => {
    const userRole = await findRole(testApp, 'user');

    const response = await request(testApp, 'POST /users', {
      accessToken: admin.accessToken,
      body: {
        email: 'Grace@Example.com',
        password: TEST_PASSWORD,
        name: 'Grace Hopper',
        roleIds: [userRole.id],
        emailVerified: true,
      },
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      email: 'grace@example.com',
      emailVerified: true,
      roles: [{ id: userRole.id, name: 'user' }],
    });
    await login(testApp, 'grace@example.com');
  });

  it('answers 409 USER_EMAIL_TAKEN for an email in use', async () => {
    const response = await request(testApp, 'POST /users', {
      accessToken: admin.accessToken,
      body: { email: 'admin@example.com', password: TEST_PASSWORD, name: 'Copy' },
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ errorCode: 'USER_EMAIL_TAKEN' });
  });

  it('answers 400 VALIDATION_FAILED at the list for role ids that are not UUIDs', async () => {
    const response = await request(testApp, 'POST /users', {
      accessToken: admin.accessToken,
      body: {
        email: 'grace@example.com',
        password: TEST_PASSWORD,
        name: 'Grace',
        roleIds: [UNKNOWN_ID, 'admin'],
      },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errorCode: 'VALIDATION_FAILED',
      details: [{ field: 'roleIds', errors: expect.any(Array) }],
    });
  });

  it('answers 400 VALIDATION_FAILED for unknown role ids, creating no user', async () => {
    const response = await request(testApp, 'POST /users', {
      accessToken: admin.accessToken,
      body: {
        email: 'grace@example.com',
        password: TEST_PASSWORD,
        name: 'Grace',
        roleIds: [UNKNOWN_ID],
      },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errorCode: 'VALIDATION_FAILED',
      details: [{ field: 'roleIds', errors: expect.any(Array) }],
    });
    const users = await request(testApp, 'GET /users?search=grace', {
      accessToken: admin.accessToken,
    });
    expect(await users.json()).toMatchObject({ total: 0 });
  });
});
