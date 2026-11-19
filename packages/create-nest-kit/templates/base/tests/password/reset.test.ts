import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createSignedInUser,
  createUser,
  expectAccessTokenRefused,
  expectRefreshTokenRefused,
  login,
  seedSystemRoles,
} from '../support/auth.js';
import { receiveVerificationToken, register } from '../support/email-verification.js';
import { request } from '../support/http.js';
import { requestResetToken, resetPassword } from '../support/password-reset.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

const NEW_PASSWORD = 'a brand new password';

describe('POST /auth/password/reset', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    // Verification on, so a successful login shows that a reset verified the address.
    testApp = await createTestApp({ EMAIL_VERIFICATION_ENABLED: 'true' });
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
    await seedSystemRoles(testApp);
  });

  it('sets the new password and signs out every session', async () => {
    const { user, accessToken, refreshToken } = await createSignedInUser(testApp);
    const token = await requestResetToken(testApp, user.email);

    const response = await resetPassword(testApp, token, NEW_PASSWORD);

    expect(response.status).toBe(204);
    await expectAccessTokenRefused(testApp, accessToken);
    await expectRefreshTokenRefused(testApp, refreshToken);
    await login(testApp, user.email, NEW_PASSWORD);
  });

  it('verifies an unverified email, since the link proves the user owns the address', async () => {
    const user = await createUser(testApp, { emailVerified: false });
    const token = await requestResetToken(testApp, user.email);

    await resetPassword(testApp, token, NEW_PASSWORD);

    const { accessToken } = await login(testApp, user.email, NEW_PASSWORD);
    const me = await request(testApp, 'GET /auth/me', { accessToken });
    expect(await me.json()).toMatchObject({ emailVerified: true });
  });

  it('accepts a token only once', async () => {
    const user = await createUser(testApp);
    const token = await requestResetToken(testApp, user.email);
    await resetPassword(testApp, token, NEW_PASSWORD);

    const response = await resetPassword(testApp, token, 'yet another password');

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
  });

  it('stops accepting a token once a newer one is mailed', async () => {
    const user = await createUser(testApp);
    const olderToken = await requestResetToken(testApp, user.email);
    await requestResetToken(testApp, user.email);

    const response = await resetPassword(testApp, olderToken, NEW_PASSWORD);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
  });

  it('refuses an email verification token', async () => {
    await register(testApp, 'ada@example.com');
    const verificationToken = await receiveVerificationToken('ada@example.com');

    const response = await resetPassword(testApp, verificationToken, NEW_PASSWORD);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
  });

  it('answers 400 AUTH_INVALID_TOKEN for an unknown token', async () => {
    const response = await resetPassword(testApp, 'not-a-token', NEW_PASSWORD);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
  });
});

describe('password reset tokens with a one-second lifetime', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ PASSWORD_RESET_TTL: '1s' });
    await seedSystemRoles(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('are refused once expired', async () => {
    const user = await createUser(testApp);
    const token = await requestResetToken(testApp, user.email);

    await sleep(1_100);
    const response = await resetPassword(testApp, token, NEW_PASSWORD);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
  });
});
