import { expect } from 'vitest';
import { TEST_PASSWORD } from './auth.js';
import { request } from './http.js';
import { clearMailbox, MailSubject, tokenFromLink, waitForMail } from './mail.js';
import type { TestApp } from './test-app.js';

/** `POST /auth/register` for `email`, expecting success. */
export async function register(testApp: TestApp, email: string): Promise<void> {
  const response = await request(testApp, 'POST /auth/register', {
    body: { email, password: TEST_PASSWORD, name: 'Ada Lovelace' },
  });
  expect(response.status).toBe(201);
}

/** Waits for the verification mail to `email`, empties the mailbox and returns the link's token. */
export async function receiveVerificationToken(email: string): Promise<string> {
  const mail = await waitForMail(email, MailSubject.VerifyEmail);
  await clearMailbox();
  return tokenFromLink(mail, '/verify-email');
}

export function verifyEmail(testApp: TestApp, token: string): Promise<Response> {
  return request(testApp, 'POST /auth/email/verify', { body: { token } });
}

export function resendVerification(testApp: TestApp, email: string): Promise<Response> {
  return request(testApp, 'POST /auth/email/resend', { body: { email } });
}
