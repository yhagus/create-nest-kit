import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedSystemRoles, TEST_PASSWORD } from '../support/auth.js';
import { register } from '../support/email-verification.js';
import { request } from '../support/http.js';
import { linkIn, MailSubject, waitForMail } from '../support/mail.js';
import { createTestApp, type TestApp } from '../support/test-app.js';
import { TEST_WEB_ORIGIN } from '../support/test-env.js';

const EMAIL = 'ada@example.com';

describe('registration with email verification enabled', () => {
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

  it('mails a link to the front end’s verification page', async () => {
    await register(testApp, EMAIL);

    const mail = await waitForMail(EMAIL, MailSubject.VerifyEmail);
    expect(linkIn(mail, '/verify-email').origin).toBe(TEST_WEB_ORIGIN);
  });

  it('refuses to sign in the unverified user with 403 AUTH_EMAIL_NOT_VERIFIED', async () => {
    await register(testApp, EMAIL);

    const response = await request(testApp, 'POST /auth/login', {
      body: { email: EMAIL, password: TEST_PASSWORD },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_EMAIL_NOT_VERIFIED' });
  });

  it('checks the password before revealing that the email is unverified', async () => {
    await register(testApp, EMAIL);

    const response = await request(testApp, 'POST /auth/login', {
      body: { email: EMAIL, password: 'wrong password' },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_CREDENTIALS' });
  });
});
