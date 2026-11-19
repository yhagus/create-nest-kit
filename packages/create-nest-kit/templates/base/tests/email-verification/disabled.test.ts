import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { login, seedSystemRoles } from '../support/auth.js';
import {
  receiveVerificationToken,
  register,
  resendVerification,
  verifyEmail,
} from '../support/email-verification.js';
import { request } from '../support/http.js';
import { expectNoMailSent } from '../support/mail.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

const EMAIL = 'ada@example.com';

describe('email verification disabled', () => {
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

  it('sends no mail on registration and lets the unverified user sign in', async () => {
    await register(testApp, EMAIL);

    await login(testApp, EMAIL);
    await expectNoMailSent(testApp);
  });

  it('still verifies an email through resend and verify', async () => {
    await register(testApp, EMAIL);

    await resendVerification(testApp, EMAIL);
    const response = await verifyEmail(testApp, await receiveVerificationToken(EMAIL));

    expect(response.status).toBe(204);
    const { accessToken } = await login(testApp, EMAIL);
    const me = await request(testApp, 'GET /auth/me', { accessToken });
    expect(await me.json()).toMatchObject({ emailVerified: true });
  });
});
