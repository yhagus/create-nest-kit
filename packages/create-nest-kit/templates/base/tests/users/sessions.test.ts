import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createSignedInUser,
  createUser,
  expectAccessTokenAccepted,
  expectAccessTokenRefused,
  expectRefreshTokenRefused,
  seedAdmin,
  type SignedInUser,
} from '../support/auth.js';
import { request } from '../support/http.js';
import { expectShape, isRecord } from '../support/json.js';
import { createTestApp, type TestApp } from '../support/test-app.js';

function isSessionList(value: unknown): value is { id: string }[] {
  return (
    Array.isArray(value) &&
    value.every((session) => isRecord(session) && typeof session['id'] === 'string')
  );
}

describe('GET and DELETE /users/:id/sessions', () => {
  let testApp: TestApp;
  let admin: SignedInUser;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
    admin = await seedAdmin(testApp);
  });

  it('lists the user’s sessions, none of them current', async () => {
    const grace = await createSignedInUser(testApp, { email: 'grace@example.com' });

    const response = await request(testApp, `GET /users/${grace.user.id}/sessions`, {
      accessToken: admin.accessToken,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      expect.objectContaining({ id: expect.any(String), current: false }),
    ]);
  });

  it('marks none current even when an admin lists their own', async () => {
    const response = await request(testApp, `GET /users/${admin.user.id}/sessions`, {
      accessToken: admin.accessToken,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([expect.objectContaining({ current: false })]);
  });

  it('signs one of the user’s devices out at once', async () => {
    const grace = await createSignedInUser(testApp, { email: 'grace@example.com' });
    const sessions = await request(testApp, `GET /users/${grace.user.id}/sessions`, {
      accessToken: admin.accessToken,
    });
    const [session] = expectShape(await sessions.json(), isSessionList, 'a list of sessions');

    const response = await request(
      testApp,
      `DELETE /users/${grace.user.id}/sessions/${session?.id}`,
      { accessToken: admin.accessToken },
    );

    expect(response.status).toBe(204);
    await expectAccessTokenRefused(testApp, grace.accessToken);
    await expectRefreshTokenRefused(testApp, grace.refreshToken);
  });

  it('answers 404 when the session belongs to someone else', async () => {
    const grace = await createUser(testApp, { email: 'grace@example.com' });
    const adminSessions = await request(testApp, `GET /users/${admin.user.id}/sessions`, {
      accessToken: admin.accessToken,
    });
    const [adminSession] = expectShape(
      await adminSessions.json(),
      isSessionList,
      'a list of sessions',
    );

    const response = await request(
      testApp,
      `DELETE /users/${grace.id}/sessions/${adminSession?.id}`,
      { accessToken: admin.accessToken },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ errorCode: 'NOT_FOUND' });
    await expectAccessTokenAccepted(testApp, admin.accessToken);
  });
});
