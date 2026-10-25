import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RolesService } from '../../src/modules/roles/roles.service.js';
import { createTestApp, type TestApp } from '../support/app.js';
import {
  createSignedInUser,
  createUser,
  expectAccessTokenAccepted,
  expectAccessTokenRefused,
  expectRefreshTokenRefused,
  login,
  seedAdmin,
  type SignedInUser,
  TEST_PASSWORD,
} from '../support/auth.js';
import { request } from '../support/http.js';
import { expectShape, isRecord } from '../support/json.js';

const UNKNOWN_ID = '01900000-0000-7000-8000-000000000000';

function isSessionList(value: unknown): value is { id: string }[] {
  return (
    Array.isArray(value) &&
    value.every((session) => isRecord(session) && typeof session['id'] === 'string')
  );
}

describe('users', () => {
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

  describe('GET /users', () => {
    it('lists one page of users by email, with the total', async () => {
      // Created out of email order, so a list in creation order would put bob last.
      await createUser(testApp, { email: 'carol@example.com' });
      await createUser(testApp, { email: 'bob@example.com' });

      const response = await request(testApp, 'GET /users?page=2&limit=2', {
        accessToken: admin.accessToken,
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        items: [expect.objectContaining({ email: 'carol@example.com' })],
        total: 3,
        page: 2,
        limit: 2,
      });
    });

    it('searches the email and the name, ignoring case', async () => {
      await createUser(testApp, { email: 'ada@example.com', name: 'Ada Lovelace' });
      await createUser(testApp, { email: 'lovelace.fan@example.com', name: 'Fan' });
      await createUser(testApp, { email: 'grace@example.com', name: 'Grace Hopper' });

      const response = await request(testApp, 'GET /users?search=LOVELACE', {
        accessToken: admin.accessToken,
      });

      expect(await response.json()).toMatchObject({
        items: [{ email: 'ada@example.com' }, { email: 'lovelace.fan@example.com' }],
        total: 2,
      });
    });

    it('returns the first page of 20 when no page is given', async () => {
      const response = await request(testApp, 'GET /users', { accessToken: admin.accessToken });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ total: 1, page: 1, limit: 20 });
    });

    it('refuses a page size over 100', async () => {
      const response = await request(testApp, 'GET /users?limit=101', {
        accessToken: admin.accessToken,
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        errorCode: 'VALIDATION_FAILED',
        details: [{ field: 'limit', errors: expect.any(Array) }],
      });
    });

    it('refuses unknown query parameters, naming them', async () => {
      const response = await request(testApp, 'GET /users?sort=name', {
        accessToken: admin.accessToken,
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        errorCode: 'VALIDATION_FAILED',
        details: [{ field: 'sort', errors: expect.any(Array) }],
      });
    });
  });

  describe('GET /users/:id', () => {
    it('returns the user, or 404 NOT_FOUND', async () => {
      const found = await request(testApp, `GET /users/${admin.user.id}`, {
        accessToken: admin.accessToken,
      });
      const missing = await request(testApp, `GET /users/${UNKNOWN_ID}`, {
        accessToken: admin.accessToken,
      });

      expect(found.status).toBe(200);
      expect(await found.json()).toMatchObject({
        email: 'admin@example.com',
        roles: [{ name: 'admin' }],
        permissions: expect.arrayContaining(['users:read', 'sessions:revoke']),
      });
      expect(missing.status).toBe(404);
      expect(await missing.json()).toMatchObject({ errorCode: 'NOT_FOUND' });
    });

    it('answers 400 BAD_REQUEST for an id that is not a UUID', async () => {
      const response = await request(testApp, 'GET /users/not-a-uuid', {
        accessToken: admin.accessToken,
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        statusCode: 400,
        errorCode: 'BAD_REQUEST',
        message: expect.any(String),
      });
    });
  });

  describe('POST /users', () => {
    it('creates a user with roles and a verified email', async () => {
      const userRole = await testApp.app.get(RolesService).getRoleByName('user');

      const response = await request(testApp, 'POST /users', {
        accessToken: admin.accessToken,
        body: {
          email: 'Grace@Example.com',
          password: TEST_PASSWORD,
          name: 'Grace Hopper',
          roleIds: [userRole.id],
          emailVerified: true,
        },
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        email: 'grace@example.com',
        emailVerified: true,
        roles: [{ id: userRole.id, name: 'user' }],
      });
      await login(testApp, 'grace@example.com');
    });

    it('answers 409 USER_EMAIL_TAKEN for an email in use', async () => {
      const response = await request(testApp, 'POST /users', {
        accessToken: admin.accessToken,
        body: { email: 'admin@example.com', password: TEST_PASSWORD, name: 'Copy' },
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ errorCode: 'USER_EMAIL_TAKEN' });
    });

    it('answers 400 VALIDATION_FAILED for role ids that are not UUIDs', async () => {
      const response = await request(testApp, 'POST /users', {
        accessToken: admin.accessToken,
        body: {
          email: 'grace@example.com',
          password: TEST_PASSWORD,
          name: 'Grace',
          roleIds: [UNKNOWN_ID, 'admin'],
        },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        errorCode: 'VALIDATION_FAILED',
        details: [{ field: 'roleIds', errors: expect.any(Array) }],
      });
    });

    it('answers 400 VALIDATION_FAILED for unknown role ids', async () => {
      const response = await request(testApp, 'POST /users', {
        accessToken: admin.accessToken,
        body: {
          email: 'grace@example.com',
          password: TEST_PASSWORD,
          name: 'Grace',
          roleIds: [UNKNOWN_ID],
        },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        errorCode: 'VALIDATION_FAILED',
        details: [{ field: 'roleIds', errors: expect.any(Array) }],
      });
    });
  });

  describe('PATCH /users/:id', () => {
    it.each(['email', 'name', 'roleIds', 'emailVerified'])(
      'answers 400 VALIDATION_FAILED for a null %s: optional means it may be left out',
      async (field) => {
        const grace = await createUser(testApp, { email: 'grace@example.com' });

        const response = await request(testApp, `PATCH /users/${grace.id}`, {
          accessToken: admin.accessToken,
          body: { [field]: null },
        });

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
          errorCode: 'VALIDATION_FAILED',
          details: [{ field, errors: expect.any(Array) }],
        });
      },
    );

    it('changes the given fields and keeps the user signed in', async () => {
      const grace = await createSignedInUser(testApp, { email: 'grace@example.com' });

      const response = await request(testApp, `PATCH /users/${grace.user.id}`, {
        accessToken: admin.accessToken,
        body: { name: 'Grace Hopper', email: 'hopper@example.com', emailVerified: false },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        name: 'Grace Hopper',
        email: 'hopper@example.com',
        emailVerified: false,
      });
      await expectAccessTokenAccepted(testApp, grace.accessToken);
    });

    it('answers 409 USER_EMAIL_TAKEN for an email in use', async () => {
      const grace = await createUser(testApp, { email: 'grace@example.com' });

      const response = await request(testApp, `PATCH /users/${grace.id}`, {
        accessToken: admin.accessToken,
        body: { email: 'Admin@example.com' },
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ errorCode: 'USER_EMAIL_TAKEN' });
    });

    it('signs the user out everywhere when their password changes', async () => {
      const grace = await createSignedInUser(testApp, { email: 'grace@example.com' });

      await request(testApp, `PATCH /users/${grace.user.id}`, {
        accessToken: admin.accessToken,
        body: { password: 'a password set by an admin' },
      });

      await expectAccessTokenRefused(testApp, grace.accessToken);
      await login(testApp, 'grace@example.com', 'a password set by an admin');
    });

    it('answers 400 VALIDATION_FAILED for unknown role ids', async () => {
      const grace = await createUser(testApp, { email: 'grace@example.com' });

      const response = await request(testApp, `PATCH /users/${grace.id}`, {
        accessToken: admin.accessToken,
        body: { roleIds: [UNKNOWN_ID] },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ errorCode: 'VALIDATION_FAILED' });
    });
  });

  describe('DELETE /users/:id', () => {
    it('deletes the user and signs them out at once', async () => {
      const grace = await createSignedInUser(testApp, { email: 'grace@example.com' });

      const response = await request(testApp, `DELETE /users/${grace.user.id}`, {
        accessToken: admin.accessToken,
      });

      expect(response.status).toBe(204);
      await expectAccessTokenRefused(testApp, grace.accessToken);
      const lookup = await request(testApp, `GET /users/${grace.user.id}`, {
        accessToken: admin.accessToken,
      });
      expect(lookup.status).toBe(404);
      expect(await lookup.json()).toMatchObject({ errorCode: 'NOT_FOUND' });
    });

    it('answers 409 USER_CANNOT_DELETE_SELF for the admin’s own account', async () => {
      const response = await request(testApp, `DELETE /users/${admin.user.id}`, {
        accessToken: admin.accessToken,
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ errorCode: 'USER_CANNOT_DELETE_SELF' });
    });
  });

  describe('GET and DELETE /users/:id/sessions', () => {
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
});
