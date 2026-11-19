import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser, seedSystemRoles, TEST_PASSWORD } from '../support/auth.js';
import { ISO_TIMESTAMP, UUID_V7 } from '../support/formats.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

const PASSWORD_MAX_LENGTH = 128;

describe('POST /auth/register', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ EMAIL_VERIFICATION_ENABLED: 'false' });
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
    await seedSystemRoles(testApp);
  });

  it('creates a user with the user role and no permissions', async () => {
    const response = await request(testApp, 'POST /auth/register', {
      body: { email: ' Ada@Example.com ', password: TEST_PASSWORD, name: ' Ada Lovelace ' },
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: expect.stringMatching(UUID_V7),
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      emailVerified: false,
      roles: [{ id: expect.stringMatching(UUID_V7), name: 'user' }],
      permissions: [],
      createdAt: expect.stringMatching(ISO_TIMESTAMP),
      updatedAt: expect.stringMatching(ISO_TIMESTAMP),
    });
  });

  it('answers 409 USER_EMAIL_TAKEN for an email in use, in any case', async () => {
    await createUser(testApp, { email: 'ada@example.com' });

    const response = await request(testApp, 'POST /auth/register', {
      body: { email: 'ADA@example.com', password: TEST_PASSWORD, name: 'Ada' },
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ errorCode: 'USER_EMAIL_TAKEN' });
  });

  it('registers only one of two simultaneous sign-ups with the same email', async () => {
    const body = { email: 'ada@example.com', password: TEST_PASSWORD, name: 'Ada' };

    const responses = await Promise.all([
      request(testApp, 'POST /auth/register', { body }),
      request(testApp, 'POST /auth/register', { body }),
    ]);

    expect(responses.map((response) => response.status).toSorted()).toEqual([201, 409]);
  });

  it('answers 400 VALIDATION_FAILED listing the invalid fields', async () => {
    const response = await request(testApp, 'POST /auth/register', {
      body: { email: 'not-an-email', password: 'short', name: 'Ada' },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errorCode: 'VALIDATION_FAILED',
      details: [
        { field: 'email', errors: expect.any(Array) },
        { field: 'password', errors: expect.any(Array) },
      ],
    });
  });

  it('refuses every unknown property, naming each', async () => {
    const response = await request(testApp, 'POST /auth/register', {
      body: {
        email: 'ada@example.com',
        password: TEST_PASSWORD,
        name: 'Ada',
        isAdmin: true,
        roleIds: [],
      },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errorCode: 'VALIDATION_FAILED',
      details: [
        { field: 'isAdmin', errors: expect.any(Array) },
        { field: 'roleIds', errors: expect.any(Array) },
      ],
    });
  });

  it('refuses a password longer than 128 characters', async () => {
    const response = await request(testApp, 'POST /auth/register', {
      body: {
        email: 'ada@example.com',
        password: 'a'.repeat(PASSWORD_MAX_LENGTH + 1),
        name: 'Ada',
      },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errorCode: 'VALIDATION_FAILED',
      details: [{ field: 'password', errors: expect.any(Array) }],
    });
  });
});
