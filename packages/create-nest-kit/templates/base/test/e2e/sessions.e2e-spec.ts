import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../support/app.js';
import {
  createSignedInUser,
  createUser,
  currentSessionId,
  expectAccessTokenAccepted,
  expectAccessTokenRefused,
  expectRefreshTokenRefused,
  login,
  refresh,
  seedSystemRoles,
} from '../support/auth.js';
import { ISO_TIMESTAMP, UUID_V7 } from '../support/formats.js';
import { request } from '../support/http.js';
import { expectShape, isRecord } from '../support/json.js';

interface ListedSession {
  id: string;
  current: boolean;
  lastUsedAt: string;
}

function isSessionList(value: unknown): value is ListedSession[] {
  return (
    Array.isArray(value) &&
    value.every(
      (session) =>
        isRecord(session) &&
        typeof session['id'] === 'string' &&
        typeof session['current'] === 'boolean' &&
        typeof session['lastUsedAt'] === 'string',
    )
  );
}

async function listSessions(testApp: TestApp, accessToken: string): Promise<ListedSession[]> {
  const response = await request(testApp, 'GET /auth/sessions', { accessToken });
  expect(response.status).toBe(200);
  return expectShape(await response.json(), isSessionList, 'a list of sessions');
}

/** The caller's sessions, expecting exactly one. */
async function onlySession(testApp: TestApp, accessToken: string): Promise<ListedSession> {
  const [session, ...others] = await listSessions(testApp, accessToken);
  if (session === undefined || others.length > 0) throw new Error('Expected exactly one session');
  return session;
}

describe('own sessions', () => {
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

  describe('GET /auth/sessions', () => {
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

  describe('DELETE /auth/sessions/:id', () => {
    it('signs that device out at once', async () => {
      const current = await createSignedInUser(testApp);
      const other = await login(testApp, current.user.email);
      const otherSessionId = await currentSessionId(testApp, other.accessToken);

      const response = await request(testApp, `DELETE /auth/sessions/${otherSessionId}`, {
        accessToken: current.accessToken,
      });

      expect(response.status).toBe(204);
      await expectAccessTokenRefused(testApp, other.accessToken);
      await expectRefreshTokenRefused(testApp, other.refreshToken);
      await expectAccessTokenAccepted(testApp, current.accessToken);
    });

    it('answers 404 for another user’s session and leaves it alone', async () => {
      const ada = await createSignedInUser(testApp);
      const grace = await createSignedInUser(testApp, { email: 'grace@example.com' });
      const graceSessionId = await currentSessionId(testApp, grace.accessToken);

      const response = await request(testApp, `DELETE /auth/sessions/${graceSessionId}`, {
        accessToken: ada.accessToken,
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ errorCode: 'NOT_FOUND' });
      await expectAccessTokenAccepted(testApp, grace.accessToken);
    });
  });

  describe('DELETE /auth/sessions', () => {
    it('signs out every other device at once and keeps the current one', async () => {
      const current = await createSignedInUser(testApp);
      const laptop = await login(testApp, current.user.email);
      const phone = await login(testApp, current.user.email);

      const response = await request(testApp, 'DELETE /auth/sessions', {
        accessToken: current.accessToken,
      });

      expect(response.status).toBe(204);
      await expectAccessTokenRefused(testApp, laptop.accessToken);
      await expectAccessTokenRefused(testApp, phone.accessToken);
      await expectRefreshTokenRefused(testApp, laptop.refreshToken);
      await expectRefreshTokenRefused(testApp, phone.refreshToken);
      expect(await listSessions(testApp, current.accessToken)).toEqual([
        expect.objectContaining({ current: true }),
      ]);
      await expectAccessTokenAccepted(testApp, current.accessToken);
    });
  });
});

describe('client ip of a session', () => {
  const PROXY_HEADERS = { 'x-forwarded-for': '203.0.113.9' };

  async function loginThroughProxy(testApp: TestApp): Promise<unknown> {
    await testApp.reset();
    await seedSystemRoles(testApp);
    await createUser(testApp);
    const { accessToken } = await login(testApp, 'ada@example.com', undefined, PROXY_HEADERS);
    const response = await request(testApp, 'GET /auth/sessions', { accessToken });
    return response.json();
  }

  it('comes from X-Forwarded-For when TRUST_PROXY is on', async () => {
    const testApp = await createTestApp({ TRUST_PROXY: 'true' });

    const sessions = await loginThroughProxy(testApp);
    await testApp.close();

    expect(sessions).toEqual([expect.objectContaining({ ip: '203.0.113.9' })]);
  });

  it('ignores X-Forwarded-For when TRUST_PROXY is off', async () => {
    const testApp = await createTestApp({ TRUST_PROXY: 'false' });

    const sessions = await loginThroughProxy(testApp);
    await testApp.close();

    expect(sessions).toEqual([
      expect.objectContaining({ ip: expect.not.stringContaining('203.0.113.9') }),
    ]);
  });
});
