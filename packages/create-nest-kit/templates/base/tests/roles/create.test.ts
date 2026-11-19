import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedAdmin, type SignedInUser } from '../support/auth.js';
import { UUID_V7 } from '../support/formats.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('POST /roles', () => {
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

  it('creates a custom role, granting each permission once', async () => {
    const response = await request(testApp, 'POST /roles', {
      accessToken: admin.accessToken,
      body: {
        name: 'support',
        description: 'Helps users',
        permissions: ['users:read', 'users:read'],
      },
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

  it('creates only one of two simultaneous roles with the same name', async () => {
    const body = { name: 'support', permissions: [] };

    const responses = await Promise.all([
      request(testApp, 'POST /roles', { accessToken: admin.accessToken, body }),
      request(testApp, 'POST /roles', { accessToken: admin.accessToken, body }),
    ]);

    expect(responses.map((response) => response.status).toSorted()).toEqual([201, 409]);
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
