import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser, seedSystemRoles, TEST_PASSWORD } from '../support/auth.js';
import { cookieValue, request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

describe('POST /auth/login', () => {
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

  it('returns a token pair and the user, and sets the refresh cookie, for the email in any case', async () => {
    const user = await createUser(testApp);

    const response = await request(testApp, 'POST /auth/login', {
      body: { email: 'ADA@example.com', password: TEST_PASSWORD },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accessToken: expect.any(String),
      refreshToken: cookieValue(response, 'refresh_token'),
      expiresIn: 900,
      tokenType: 'Bearer',
      user: expect.objectContaining({ id: user.id, email: 'ada@example.com' }),
    });
  });

  it('answers 401 AUTH_INVALID_CREDENTIALS alike for a wrong password and an unknown email', async () => {
    await createUser(testApp);

    const wrongPassword = await request(testApp, 'POST /auth/login', {
      body: { email: 'ada@example.com', password: 'wrong password' },
    });
    const unknownEmail = await request(testApp, 'POST /auth/login', {
      body: { email: 'nobody@example.com', password: TEST_PASSWORD },
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    const wrongPasswordBody = await wrongPassword.json();
    expect(wrongPasswordBody).toMatchObject({ errorCode: 'AUTH_INVALID_CREDENTIALS' });
    expect(await unknownEmail.json()).toEqual(wrongPasswordBody);
  });

  it('validates a request without a body as an empty one, listing the missing fields', async () => {
    const response = await request(testApp, 'POST /auth/login');

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errorCode: 'VALIDATION_FAILED',
      details: [
        { field: 'email', errors: expect.any(Array) },
        { field: 'password', errors: expect.any(Array) },
      ],
    });
  });
});
