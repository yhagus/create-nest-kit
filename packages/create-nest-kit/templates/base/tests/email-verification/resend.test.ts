import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser, seedSystemRoles } from '../support/auth.js';
import {
  receiveVerificationToken,
  register,
  resendVerification,
  verifyEmail,
} from '../support/email-verification.js';
import { expectNoMailSent } from '../support/mail.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

const EMAIL = 'ada@example.com';

describe('POST /auth/email/resend', () => {
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

  it('mails a new link and stops accepting the older one', async () => {
    await register(testApp, EMAIL);
    const olderToken = await receiveVerificationToken(EMAIL);

    const response = await resendVerification(testApp, EMAIL);

    expect(response.status).toBe(202);
    const newerToken = await receiveVerificationToken(EMAIL);
    const withOlderToken = await verifyEmail(testApp, olderToken);
    expect(withOlderToken.status).toBe(400);
    expect(await withOlderToken.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
    expect((await verifyEmail(testApp, newerToken)).status).toBe(204);
  });

  it('answers 202 for a verified or unknown email, without sending anything', async () => {
    await createUser(testApp, { email: 'verified@example.com', emailVerified: true });

    const forVerified = await resendVerification(testApp, 'verified@example.com');
    const forUnknown = await resendVerification(testApp, 'nobody@example.com');

    expect(forVerified.status).toBe(202);
    expect(forUnknown.status).toBe(202);
    await expectNoMailSent(testApp);
  });
});
