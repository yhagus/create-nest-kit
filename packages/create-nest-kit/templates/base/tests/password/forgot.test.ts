import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser, seedSystemRoles } from '../support/auth.js';
import { request } from '../support/http.js';
import { expectNoMailSent, linkIn, MailSubject, waitForMail } from '../support/mail.js';
import { createTestApp, type TestApp } from '../support/test-app.js';
import { TEST_WEB_ORIGIN } from '../support/test-env.js';

describe('POST /auth/password/forgot', () => {
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

  it('mails a link to the front end’s reset page', async () => {
    await createUser(testApp);

    const response = await request(testApp, 'POST /auth/password/forgot', {
      body: { email: 'ADA@example.com' },
    });

    expect(response.status).toBe(202);
    const mail = await waitForMail('ada@example.com', MailSubject.ResetPassword);
    expect(linkIn(mail, '/reset-password').origin).toBe(TEST_WEB_ORIGIN);
  });

  it('answers 202 for an unknown email too, without sending anything', async () => {
    const response = await request(testApp, 'POST /auth/password/forgot', {
      body: { email: 'nobody@example.com' },
    });

    expect(response.status).toBe(202);
    await expectNoMailSent(testApp);
  });
});
