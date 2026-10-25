import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { VerifyEmailMail } from '../../src/infra/mail/mailables/verify-email.mail.js';
import { createTestApp, TEST_WEB_ORIGIN, type TestApp } from '../support/app.js';
import {
  createUser,
  login,
  seedSystemRoles,
  TEST_PASSWORD,
  tokenFromLink,
  waitForMail,
  waitForMailQueueToDrain,
} from '../support/auth.js';
import { request } from '../support/http.js';

const EMAIL = 'ada@example.com';

async function register(testApp: TestApp): Promise<void> {
  const response = await request(testApp, 'POST /auth/register', {
    body: { email: EMAIL, password: TEST_PASSWORD, name: 'Ada Lovelace' },
  });
  expect(response.status).toBe(201);
}

/** Waits for the verification mail to EMAIL, empties the mailbox and returns the link's token. */
async function receiveVerificationToken(testApp: TestApp): Promise<string> {
  const mail = await waitForMail(testApp, EMAIL, VerifyEmailMail);
  testApp.mailbox.clear();
  return tokenFromLink(mail, '/verify-email');
}

function verify(testApp: TestApp, token: string): Promise<Response> {
  return request(testApp, 'POST /auth/email/verify', { body: { token } });
}

function resend(testApp: TestApp, email: string): Promise<Response> {
  return request(testApp, 'POST /auth/email/resend', { body: { email } });
}

describe('email verification enabled', () => {
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

  it('mails a link to the front end’s verification page on registration', async () => {
    await register(testApp);

    const mail = await waitForMail(testApp, EMAIL, VerifyEmailMail);
    expect(mail.link('/verify-email').origin).toBe(TEST_WEB_ORIGIN);
  });

  it('refuses to sign in an unverified user with 403 AUTH_EMAIL_NOT_VERIFIED', async () => {
    await register(testApp);

    const response = await request(testApp, 'POST /auth/login', {
      body: { email: EMAIL, password: TEST_PASSWORD },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_EMAIL_NOT_VERIFIED' });
  });

  it('checks the password before revealing that the email is unverified', async () => {
    await register(testApp);

    const response = await request(testApp, 'POST /auth/login', {
      body: { email: EMAIL, password: 'wrong password' },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_CREDENTIALS' });
  });

  it('verifies the email with the mailed token, after which the user can sign in', async () => {
    await register(testApp);
    const token = await receiveVerificationToken(testApp);

    const response = await verify(testApp, token);

    expect(response.status).toBe(204);
    const { accessToken } = await login(testApp, EMAIL);
    const me = await request(testApp, 'GET /auth/me', { accessToken });
    expect(await me.json()).toMatchObject({ emailVerified: true });
  });

  it('accepts a verification token only once', async () => {
    await register(testApp);
    const token = await receiveVerificationToken(testApp);
    await verify(testApp, token);

    const response = await verify(testApp, token);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
  });

  it('resends a new link and stops accepting the older one', async () => {
    await register(testApp);
    const olderToken = await receiveVerificationToken(testApp);

    const response = await resend(testApp, EMAIL);

    expect(response.status).toBe(202);
    const newerToken = await receiveVerificationToken(testApp);
    const withOlderToken = await verify(testApp, olderToken);
    expect(withOlderToken.status).toBe(400);
    expect(await withOlderToken.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
    expect((await verify(testApp, newerToken)).status).toBe(204);
  });

  it('answers 400 AUTH_INVALID_TOKEN for an unknown token', async () => {
    const response = await verify(testApp, 'not-a-token');

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
  });

  it('answers 202 to a resend for a verified or unknown email, without sending anything', async () => {
    await createUser(testApp, { email: 'verified@example.com', emailVerified: true });

    const forVerified = await resend(testApp, 'verified@example.com');
    const forUnknown = await resend(testApp, 'nobody@example.com');

    expect(forVerified.status).toBe(202);
    expect(forUnknown.status).toBe(202);
    await waitForMailQueueToDrain(testApp);
    expect(testApp.mailbox.mails).toEqual([]);
  });
});

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
    await register(testApp);

    await login(testApp, EMAIL);
    await waitForMailQueueToDrain(testApp);
    expect(testApp.mailbox.mails).toEqual([]);
  });

  it('still verifies an email through resend and verify', async () => {
    await register(testApp);

    await resend(testApp, EMAIL);
    const response = await verify(testApp, await receiveVerificationToken(testApp));

    expect(response.status).toBe(204);
    const { accessToken } = await login(testApp, EMAIL);
    const me = await request(testApp, 'GET /auth/me', { accessToken });
    expect(await me.json()).toMatchObject({ emailVerified: true });
  });
});

describe('verification tokens with a one-second lifetime', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ EMAIL_VERIFICATION_TTL: '1s' });
    await seedSystemRoles(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('are refused once expired', async () => {
    await register(testApp);
    const token = await receiveVerificationToken(testApp);

    await sleep(1_100);
    const response = await verify(testApp, token);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_TOKEN' });
  });
});
