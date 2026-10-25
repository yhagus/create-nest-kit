import { getQueueToken } from '@nestjs/bullmq';
import type { Type } from '@nestjs/common';
import type { SentMail } from '@nestjs/mail';
import type { Queue } from 'bullmq';
import { expect, vi } from 'vitest';
import { MAIL_QUEUE } from '../../src/infra/queue/queue-names.js';
import { type Role, SystemRoleName } from '../../src/modules/roles/role.js';
import { RolesService } from '../../src/modules/roles/roles.service.js';
import type { User } from '../../src/modules/users/user.js';
import { type CreateUserInput, UsersService } from '../../src/modules/users/users.service.js';
import type { TestApp } from './app.js';
import { request } from './http.js';
import { expectShape, isRecord } from './json.js';

// Seeding goes through the domain services, the same in every auth style; signing in goes
// through HTTP, like a real client.

export const TEST_PASSWORD = 'correct horse battery';
const MAIL_TIMEOUT_MS = 5_000;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

function isTokenPair(value: unknown): value is TokenPair {
  return (
    isRecord(value) &&
    typeof value['accessToken'] === 'string' &&
    typeof value['refreshToken'] === 'string' &&
    typeof value['expiresIn'] === 'number' &&
    value['tokenType'] === 'Bearer'
  );
}

/** Only the token pair of a response body, which may also hold the user. */
function toTokenPair(body: unknown): TokenPair {
  const { accessToken, refreshToken, expiresIn, tokenType } = expectShape(
    body,
    isTokenPair,
    'a token pair',
  );
  return { accessToken, refreshToken, expiresIn, tokenType };
}

export interface SignedInUser extends TokenPair {
  user: User;
  password: string;
}

/** Creates the system roles `admin` and `user`, as `db:seed` does. */
export async function seedSystemRoles(testApp: TestApp): Promise<{ admin: Role; user: Role }> {
  return testApp.app.get(RolesService).syncSystemRoles();
}

/** A verified user with the `user` role (or the given `roleIds`), created directly. Seed the system roles first. */
export async function createUser(
  testApp: TestApp,
  overrides: Partial<CreateUserInput> = {},
): Promise<User> {
  const userRole = await testApp.app.get(RolesService).getRoleByName(SystemRoleName.User);
  return testApp.app.get(UsersService).createUser({
    email: 'ada@example.com',
    password: TEST_PASSWORD,
    name: 'Ada Lovelace',
    roleIds: [userRole.id],
    emailVerified: true,
    ...overrides,
  });
}

/** `POST /auth/login`, expecting success. */
export async function login(
  testApp: TestApp,
  email: string,
  password: string = TEST_PASSWORD,
  headers: Record<string, string> = {},
): Promise<TokenPair> {
  const response = await request(testApp, 'POST /auth/login', {
    body: { email, password },
    headers,
  });
  expect(response.status).toBe(200);
  return toTokenPair(await response.json());
}

/** `POST /auth/refresh` with the token in the body, expecting success. */
export async function refresh(testApp: TestApp, refreshToken: string): Promise<TokenPair> {
  const response = await request(testApp, 'POST /auth/refresh', { body: { refreshToken } });
  expect(response.status).toBe(200);
  return toTokenPair(await response.json());
}

/** A new user (see `createUser`), signed in. */
export async function createSignedInUser(
  testApp: TestApp,
  overrides: Partial<CreateUserInput> = {},
): Promise<SignedInUser> {
  const user = await createUser(testApp, overrides);
  const password = overrides.password ?? TEST_PASSWORD;
  return { user, password, ...(await login(testApp, user.email, password)) };
}

/** Seeds the system roles and an admin holding every permission, signed in. */
export async function seedAdmin(testApp: TestApp): Promise<SignedInUser> {
  const { admin } = await seedSystemRoles(testApp);
  return createSignedInUser(testApp, {
    email: 'admin@example.com',
    name: 'Admin',
    roleIds: [admin.id],
  });
}

function isSessionList(value: unknown): value is { id: string; current: boolean }[] {
  return (
    Array.isArray(value) &&
    value.every(
      (session) =>
        isRecord(session) &&
        typeof session['id'] === 'string' &&
        typeof session['current'] === 'boolean',
    )
  );
}

/** The id of the session `accessToken` belongs to, as `GET /auth/sessions` marks it `current`. */
export async function currentSessionId(testApp: TestApp, accessToken: string): Promise<string> {
  const response = await request(testApp, 'GET /auth/sessions', { accessToken });
  expect(response.status).toBe(200);
  const sessions = expectShape(await response.json(), isSessionList, 'a list of sessions');
  const current = sessions.find((session) => session.current);
  if (!current) throw new Error('No session is marked current');
  return current.id;
}

/** Expects `GET /auth/me` to accept `accessToken`. */
export async function expectAccessTokenAccepted(
  testApp: TestApp,
  accessToken: string,
): Promise<void> {
  const response = await request(testApp, 'GET /auth/me', { accessToken });
  expect(response.status).toBe(200);
}

/**
 * Expects `GET /auth/me` to refuse `accessToken` as unauthenticated: exactly 401
 * `AUTH_UNAUTHENTICATED`, so a crash (500) or a permission error never passes for a refusal.
 */
export async function expectAccessTokenRefused(
  testApp: TestApp,
  accessToken: string,
): Promise<void> {
  const response = await request(testApp, 'GET /auth/me', { accessToken });
  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ errorCode: 'AUTH_UNAUTHENTICATED' });
}

/** Expects `POST /auth/refresh` to refuse `refreshToken` with 401 `AUTH_INVALID_REFRESH_TOKEN`. */
export async function expectRefreshTokenRefused(
  testApp: TestApp,
  refreshToken: string,
): Promise<void> {
  const response = await request(testApp, 'POST /auth/refresh', { body: { refreshToken } });
  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ errorCode: 'AUTH_INVALID_REFRESH_TOKEN' });
}

/** Waits for the queued mail of class `mail` to `to` to arrive in the mailbox. */
export function waitForMail(testApp: TestApp, to: string, mail: Type): Promise<SentMail> {
  return vi.waitFor(() => testApp.mailbox.assertSent({ to, mail }), {
    timeout: MAIL_TIMEOUT_MS,
  });
}

/** The `token` query parameter of the first link in `mail` whose path is `path`. */
export function tokenFromLink(mail: SentMail, path: string): string {
  const token = mail.link(path).searchParams.get('token');
  if (token === null) throw new Error(`The ${path} link has no token`);
  return token;
}

/** Waits until every queued mail was handled, so a test can check that one was not sent. */
export async function waitForMailQueueToDrain(testApp: TestApp): Promise<void> {
  const queue = testApp.app.get<Queue>(getQueueToken(MAIL_QUEUE));
  await vi.waitFor(
    async () => {
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'prioritized');
      expect(Object.values(counts).every((count) => count === 0)).toBe(true);
    },
    { timeout: MAIL_TIMEOUT_MS },
  );
}
