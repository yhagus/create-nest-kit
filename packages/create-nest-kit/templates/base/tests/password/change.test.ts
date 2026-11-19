import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createSignedInUser,
  expectAccessTokenAccepted,
  expectAccessTokenRefused,
  expectRefreshTokenRefused,
  login,
  seedSystemRoles,
  TEST_PASSWORD,
} from '../support/auth.js';
import { request } from '../support/http.js';
import { MailSubject, waitForMail } from '../support/mail.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

const NEW_PASSWORD = 'a brand new password';

describe('POST /auth/password/change', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
    await seedSystemRoles(testApp);
  });

  it('sets the new password and signs out the other devices, keeping this one', async () => {
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
  });

  it('mails the owner a notice, rendered from its template', async () => {
    const { accessToken, user } = await createSignedInUser(testApp, { name: 'Ada' });

    await request(testApp, 'POST /auth/password/change', {
      accessToken,
      body: { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD },
    });

    const mail = await waitForMail(user.email, MailSubject.PasswordChanged);
    expect(mail.html).toContain('Hi Ada,');
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
