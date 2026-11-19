import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createSignedInUser,
  createUser,
  expectAccessTokenAccepted,
  login,
  refresh,
  seedSystemRoles,
} from '../support/auth.js';
import { ISO_TIMESTAMP, UUID_V7 } from '../support/formats.js';
import { request } from '../support/http.js';
import { expectShape, isRecord } from '../support/json.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

interface ListedSession {
  id: string;
  lastUsedAt: string;
}

function isSessionList(value: unknown): value is ListedSession[] {
  return (
    Array.isArray(value) &&
    value.every(
      (session) =>
        isRecord(session) &&
        typeof session['id'] === 'string' &&
        typeof session['lastUsedAt'] === 'string',
    )
  );
}

/** The caller's sessions, expecting exactly one. */
async function onlySession(testApp: TestApp, accessToken: string): Promise<ListedSession> {
  const response = await request(testApp, 'GET /auth/sessions', { accessToken });
  expect(response.status).toBe(200);
  const [session, ...others] = expectShape(await response.json(), isSessionList, 'sessions');
  if (session === undefined || others.length > 0) throw new Error('Expected exactly one session');
  return session;
}

describe('GET /auth/sessions', () => {
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

  it('lists the active sessions newest first, with device details, marking the current one', async () => {
    await createUser(testApp);
    const laptop = await login(testApp, 'ada@example.com', undefined, {
      'user-agent': 'Laptop/1.0',
    });
    const phone = await login(testApp, 'ada@example.com', undefined, {
      'user-agent': 'Phone/2.0',
    });
    await request(testApp, 'POST /auth/logout', {
      accessToken: (await login(testApp, 'ada@example.com')).accessToken,
    });

    const response = await request(testApp, 'GET /auth/sessions', {
      accessToken: laptop.accessToken,
    });

    expect(response.status).toBe(200);
    const sessionFields = {
      id: expect.stringMatching(UUID_V7),
      ip: expect.any(String),
      createdAt: expect.stringMatching(ISO_TIMESTAMP),
      lastUsedAt: expect.stringMatching(ISO_TIMESTAMP),
      expiresAt: expect.stringMatching(ISO_TIMESTAMP),
    };
    expect(await response.json()).toEqual([
      { ...sessionFields, userAgent: 'Phone/2.0', current: false },
      { ...sessionFields, userAgent: 'Laptop/1.0', current: true },
    ]);
    await expectAccessTokenAccepted(testApp, phone.accessToken);
  });

  it('moves lastUsedAt forward on each refresh', async () => {
    const { accessToken, refreshToken } = await createSignedInUser(testApp);
    const beforeRefresh = await onlySession(testApp, accessToken);
    // Timestamps have millisecond precision; make sure the refresh lands in a later one.
    await sleep(10);

    const renewed = await refresh(testApp, refreshToken);

    const afterRefresh = await onlySession(testApp, renewed.accessToken);
    expect(afterRefresh.id).toBe(beforeRefresh.id);
    expect(Date.parse(afterRefresh.lastUsedAt)).toBeGreaterThan(
      Date.parse(beforeRefresh.lastUsedAt),
    );
  });
});
