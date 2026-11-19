import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { login, seedSystemRoles } from '../support/auth.js';
import { receiveVerificationToken, register, verifyEmail } from '../support/email-verification.js';
import { request } from '../support/http.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

const EMAIL = 'ada@example.com';

describe('POST /auth/email/verify', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ EMAIL_VERIFICATION_ENABLED: 'true' });
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
    await seedSystemRoles(testApp);
  });

  it('verifies the email with the mailed token, after which the user can sign in', async () => {
    await register(testApp, EMAIL);
    const token = await receiveVerificationToken(EMAIL);

    const response = await verifyEmail(testApp, token);

    expect(response.status).toBe(204);
    const { accessToken } = await login(testApp, EMAIL);
    const me = await request(testApp, 'GET /auth/me', { accessToken });
    expect(await me.json()).toMatchObject({ emailVerified: true });
  });

  it('accepts a verification token only once', async () => {
    await register(testApp, EMAIL);
    const token = await receiveVerificationToken(EMAIL);
    await verifyEmail(testApp, token);

    const response = await verifyEmail(testApp, token);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
  });

  it('answers 400 AUTH_INVALID_TOKEN for an unknown token', async () => {
    const response = await verifyEmail(testApp, 'not-a-token');

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
  });
});

describe('verification tokens with a one-second lifetime', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ EMAIL_VERIFICATION_TTL: '1s' });
    await seedSystemRoles(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('are refused once expired', async () => {
    await register(testApp, EMAIL);
    const token = await receiveVerificationToken(EMAIL);

    await sleep(1_100);
    const response = await verifyEmail(testApp, token);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
  });
});
