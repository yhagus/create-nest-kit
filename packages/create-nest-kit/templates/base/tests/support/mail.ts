import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { expect, inject, vi } from 'vitest';
import { MAIL_QUEUE } from '../../src/infra/queue/queue-names.js';
import { expectShape, isRecord } from './json.js';
import type { TestApp } from './test-app.js';

// The app sends mail over SMTP to the Mailpit container; these helpers read it back through
// Mailpit's HTTP API (https://mailpit.axllent.org/docs/api-v1/).

const MAIL_TIMEOUT_MS = 5_000;

/** The subjects of the mails the app sends, with the test app's APP_NAME. */
export const MailSubject = {
  VerifyEmail: 'Verify your email address for test-app',
  ResetPassword: 'Reset your test-app password',
  PasswordChanged: 'Your test-app password was changed',
} as const;
export type MailSubject = (typeof MailSubject)[keyof typeof MailSubject];

export interface ReceivedMail {
  subject: string;
  html: string;
}

interface MessageSummary {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

function isMessageSummary(value: unknown): value is MessageSummary {
  return (
    isRecord(value) &&
    typeof value['ID'] === 'string' &&
    typeof value['Subject'] === 'string' &&
    Array.isArray(value['To']) &&
    value['To'].every(
      (recipient) => isRecord(recipient) && typeof recipient['Address'] === 'string',
    )
  );
}

function isMessageList(value: unknown): value is { messages: MessageSummary[] } {
  return (
    isRecord(value) && Array.isArray(value['messages']) && value['messages'].every(isMessageSummary)
  );
}

function isMessage(value: unknown): value is { Subject: string; HTML: string } {
  return (
    isRecord(value) && typeof value['Subject'] === 'string' && typeof value['HTML'] === 'string'
  );
}

async function mailpit(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${inject('mailpitUrl')}/api/v1${path}`, init);
  if (!response.ok) {
    throw new Error(`Mailpit answered ${init.method ?? 'GET'} ${path} with ${response.status}`);
  }
  // Mailpit answers a DELETE with a plain-text `ok`.
  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
  return isJson ? response.json() : undefined;
}

/** Every mail Mailpit holds, newest first. */
async function listMail(): Promise<MessageSummary[]> {
  return expectShape(await mailpit('/messages'), isMessageList, 'a Mailpit message list').messages;
}

/** Deletes every mail Mailpit holds. `TestApp.reset()` calls it. */
export async function clearMailbox(): Promise<void> {
  await mailpit('/messages', { method: 'DELETE' });
}

/** Waits for the newest mail with `subject` to `to` to arrive in Mailpit. */
export async function waitForMail(to: string, subject: MailSubject): Promise<ReceivedMail> {
  const summary = await vi.waitFor(
    async () => {
      const found = (await listMail()).find(
        (message) =>
          message.Subject === subject && message.To.some((recipient) => recipient.Address === to),
      );
      if (!found) throw new Error(`No mail "${subject}" to ${to} has arrived`);
      return found;
    },
    { timeout: MAIL_TIMEOUT_MS },
  );
  const message = expectShape(
    await mailpit(`/message/${summary.ID}`),
    isMessage,
    'a Mailpit message',
  );
  return { subject: message.Subject, html: message.HTML };
}

/** The first link in `mail` whose path is `path`. */
export function linkIn(mail: ReceivedMail, path: string): URL {
  const hrefs = [...mail.html.matchAll(/href="([^"]+)"/g)].map(([, href = '']) =>
    href.replaceAll('&amp;', '&'),
  );
  const link = hrefs.map((href) => new URL(href)).find((url) => url.pathname === path);
  if (!link) throw new Error(`The mail "${mail.subject}" has no link to ${path}`);
  return link;
}

/** The `token` query parameter of the first link in `mail` whose path is `path`. */
export function tokenFromLink(mail: ReceivedMail, path: string): string {
  const token = linkIn(mail, path).searchParams.get('token');
  if (token === null) throw new Error(`The ${path} link has no token`);
  return token;
}

/** Waits until every queued mail was handled, then expects Mailpit to hold none. */
export async function expectNoMailSent(testApp: TestApp): Promise<void> {
  const queue = testApp.app.get<Queue>(getQueueToken(MAIL_QUEUE));
  await vi.waitFor(
    async () => {
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'prioritized');
      expect(Object.values(counts).every((count) => count === 0)).toBe(true);
    },
    { timeout: MAIL_TIMEOUT_MS },
  );
  expect(await listMail()).toEqual([]);
}
