import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MailQueue } from '../../src/infra/mail/mail.queue.js';
import { PasswordChangedMail } from '../../src/infra/mail/mailables/password-changed.mail.js';
import { createTestApp, type TestApp } from '../support/app.js';

const DELIVERY_TIMEOUT_MS = 5_000;

describe('mail queue', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('delivers a queued mail, rendered from its template', async () => {
    await testApp.app
      .get(MailQueue)
      .enqueue({ mail: 'password-changed', to: 'ada@example.com', data: { name: 'Ada' } });

    const mail = await vi.waitFor(
      () => testApp.mailbox.assertSent({ to: 'ada@example.com', mail: PasswordChangedMail }),
      { timeout: DELIVERY_TIMEOUT_MS },
    );
    expect(mail.subject).toBe('Your test-app password was changed');
    expect(mail.html).toContain('Hi Ada,');
  });
});
