import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PasswordChangedMail } from '../../src/infra/mail/mailables/password-changed.mail.js';
import { ResetPasswordMail } from '../../src/infra/mail/mailables/reset-password.mail.js';
import { createTestApp, TEST_WEB_ORIGIN, type TestApp } from '../support/app.js';
import {
  createSignedInUser,
  createUser,
  expectAccessTokenAccepted,
  expectAccessTokenRefused,
  expectRefreshTokenRefused,
  login,
  seedSystemRoles,
  TEST_PASSWORD,
  tokenFromLink,
  waitForMail,
  waitForMailQueueToDrain,
} from '../support/auth.js';
import { request } from '../support/http.js';

const NEW_PASSWORD = 'a brand new password';

async function requestResetToken(testApp: TestApp, email: string): Promise<string> {
  const response = await request(testApp, 'POST /auth/password/forgot', { body: { email } });
  expect(response.status).toBe(202);
  const mail = await waitForMail(testApp, email, ResetPasswordMail);
  testApp.mailbox.clear();
  return tokenFromLink(mail, '/reset-password');
}

describe('passwords', () => {
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

  describe('POST /auth/password/change', () => {
    it('sets the new password, signs out the other devices and mails a notice', async () => {
      const current = await createSignedInUser(testApp);
      const other = await login(testApp, current.user.email);

      const response = await request(testApp, 'POST /auth/password/change', {
        accessToken: current.accessToken,
        body: { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD },
      });

      expect(response.status).toBe(204);
      await expectAccessTokenRefused(testApp, other.accessToken);
      await expectRefreshTokenRefused(testApp, other.refreshToken);
      await expectAccessTokenAccepted(testApp, current.accessToken);
      await login(testApp, current.user.email, NEW_PASSWORD);
      await waitForMail(testApp, current.user.email, PasswordChangedMail);
    });

    it('stops accepting the old password', async () => {
      const { accessToken, user } = await createSignedInUser(testApp);

      await request(testApp, 'POST /auth/password/change', {
        accessToken,
        body: { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD },
      });

      const response = await request(testApp, 'POST /auth/login', {
        body: { email: user.email, password: TEST_PASSWORD },
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_CREDENTIALS' });
    });

    it('answers 400 AUTH_INVALID_CURRENT_PASSWORD when the current password is wrong', async () => {
      const { accessToken, user } = await createSignedInUser(testApp);

      const response = await request(testApp, 'POST /auth/password/change', {
        accessToken,
        body: { currentPassword: 'wrong password', newPassword: NEW_PASSWORD },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_CURRENT_PASSWORD' });
      await login(testApp, user.email, TEST_PASSWORD);
    });
  });

  describe('POST /auth/password/forgot', () => {
    it('mails a link to the front end’s reset page', async () => {
      await createUser(testApp);

      const response = await request(testApp, 'POST /auth/password/forgot', {
        body: { email: 'ADA@example.com' },
      });

      expect(response.status).toBe(202);
      const mail = await waitForMail(testApp, 'ada@example.com', ResetPasswordMail);
      expect(mail.link('/reset-password').origin).toBe(TEST_WEB_ORIGIN);
    });

    it('answers 202 for an unknown email too, without sending anything', async () => {
      const response = await request(testApp, 'POST /auth/password/forgot', {
        body: { email: 'nobody@example.com' },
      });

      expect(response.status).toBe(202);
      await waitForMailQueueToDrain(testApp);
      expect(testApp.mailbox.mails).toEqual([]);
    });
  });

  describe('POST /auth/password/reset', () => {
    it('sets the new password and signs out every session', async () => {
      const { user, accessToken, refreshToken } = await createSignedInUser(testApp);
      const token = await requestResetToken(testApp, user.email);

      const response = await request(testApp, 'POST /auth/password/reset', {
        body: { token, password: NEW_PASSWORD },
      });

      expect(response.status).toBe(204);
      await expectAccessTokenRefused(testApp, accessToken);
      await expectRefreshTokenRefused(testApp, refreshToken);
      await login(testApp, user.email, NEW_PASSWORD);
    });

    it('verifies an unverified email, since the link proves the user owns the address', async () => {
      const user = await createUser(testApp, { emailVerified: false });
      const token = await requestResetToken(testApp, user.email);

      await request(testApp, 'POST /auth/password/reset', {
        body: { token, password: NEW_PASSWORD },
      });

      const { accessToken } = await login(testApp, user.email, NEW_PASSWORD);
      const me = await request(testApp, 'GET /auth/me', { accessToken });
      expect(await me.json()).toMatchObject({ emailVerified: true });
    });

    it('accepts a token only once', async () => {
      const user = await createUser(testApp);
      const token = await requestResetToken(testApp, user.email);
      await request(testApp, 'POST /auth/password/reset', {
        body: { token, password: NEW_PASSWORD },
      });

      const response = await request(testApp, 'POST /auth/password/reset', {
        body: { token, password: 'yet another password' },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
    });

    it('stops accepting a token once a newer one is mailed', async () => {
      const user = await createUser(testApp);
      const olderToken = await requestResetToken(testApp, user.email);
      await requestResetToken(testApp, user.email);

      const response = await request(testApp, 'POST /auth/password/reset', {
        body: { token: olderToken, password: NEW_PASSWORD },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
    });

    it('answers 400 AUTH_INVALID_TOKEN for an unknown token', async () => {
      const response = await request(testApp, 'POST /auth/password/reset', {
        body: { token: 'not-a-token', password: NEW_PASSWORD },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
    });
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
    const response = await request(testApp, 'POST /auth/password/reset', {
      body: { token, password: NEW_PASSWORD },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
  });
});
