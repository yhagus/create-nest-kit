import { expect } from 'vitest';
import { request } from './http.js';
import { clearMailbox, MailSubject, tokenFromLink, waitForMail } from './mail.js';
import type { TestApp } from './test-app.js';

/** `POST /auth/password/forgot` for `email`; waits for the mail, empties the mailbox and returns the link's token. */
export async function requestResetToken(testApp: TestApp, email: string): Promise<string> {
  const response = await request(testApp, 'POST /auth/password/forgot', { body: { email } });
  expect(response.status).toBe(202);
  const mail = await waitForMail(email, MailSubject.ResetPassword);
  await clearMailbox();
  return tokenFromLink(mail, '/reset-password');
}

export function resetPassword(
  testApp: TestApp,
  token: string,
  password: string,
): Promise<Response> {
  return request(testApp, 'POST /auth/password/reset', { body: { token, password } });
}
