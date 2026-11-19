import { describe, expect, inject, it } from 'vitest';
import { createTestApp } from '../support/test-app.js';

describe('starting the app with an invalid environment', () => {
  it("refuses, listing every invalid variable, the app's and the database's together", async () => {
    const invalidDatabaseEnv = Object.fromEntries(
      Object.keys(inject('databaseEnv')).map((key) => [key, 'not a url']),
    );

    const boot = createTestApp({
      JWT_SECRET: 'short',
      ACCESS_TOKEN_TTL: '1w',
      AUTH_THROTTLE_LOGIN: '3/15w',
      ...invalidDatabaseEnv,
    });

    await expect(boot).rejects.toThrow(/^Invalid environment variables:/);
    await expect(boot).rejects.toThrow(/JWT_SECRET/);
    await expect(boot).rejects.toThrow(/ACCESS_TOKEN_TTL/);
    await expect(boot).rejects.toThrow(/AUTH_THROTTLE_LOGIN/);
    await expect(boot).rejects.toThrow(new RegExp(Object.keys(invalidDatabaseEnv).join('|')));
  });

  it('refuses MAIL_TRANSPORT=smtp without SMTP_URL', async () => {
    await expect(createTestApp({ SMTP_URL: undefined })).rejects.toThrow(/SMTP_URL/);
  });

  it('refuses MAIL_TRANSPORT=resend without RESEND_API_KEY', async () => {
    await expect(createTestApp({ MAIL_TRANSPORT: 'resend' })).rejects.toThrow(/RESEND_API_KEY/);
  });
});
