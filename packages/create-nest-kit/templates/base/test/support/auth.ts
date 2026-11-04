import { getQueueToken } from '@nestjs/bullmq';
import type { Type } from '@nestjs/common';
import type { SentMail } from '@nestjs/mail';
import type { Queue } from 'bullmq';
import { expect, vi } from 'vitest';
import { PasswordHasher } from '../../src/auth/password-hasher.js';
import { MAIL_QUEUE } from '../../src/infra/queue/queue-names.js';
import { ALL_PERMISSIONS } from '../../src/modules/permissions/permission.js';
import { type Role, SystemRoleName } from '../../src/modules/roles/role.js';
import { type NewRole, RolesRepository } from '../../src/modules/roles/roles.repository.js';
import { normalizeEmail } from '../../src/modules/users/email.js';
import type { User } from '../../src/modules/users/user.js';
import { UsersRepository } from '../../src/modules/users/users.repository.js';
import type { TestApp } from './app.js';
import { request } from './http.js';
import { expectShape, isRecord } from './json.js';

// Seeding writes through the repository ports and `PasswordHasher`, so it doesn't depend on the
// services or handlers behind the routes; signing in goes through HTTP, like a real client.

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

export interface NewTestUser {
  email: string;
  password: string;
  name: string;
  roleIds: string[];
  emailVerified: boolean;
}

/** Creates the system roles `admin` and `user`, as `db:seed` does, unless they exist. */
export async function seedSystemRoles(testApp: TestApp): Promise<{ admin: Role; user: Role }> {
  const admin = await ensureRole(testApp, {
    name: SystemRoleName.Admin,
    description: 'Full access',
    permissions: [...ALL_PERMISSIONS],
    isSystem: true,
  });
  const user = await ensureRole(testApp, {
    name: SystemRoleName.User,
    description: 'Every self-registered user',
    permissions: [],
    isSystem: true,
  });
  return { admin, user };
}

async function ensureRole(testApp: TestApp, role: NewRole): Promise<Role> {
  const roles = testApp.app.get(RolesRepository);
  return (await roles.findByName(role.name)) ?? roles.create(role);
}

/** The role named `name`; seed the system roles first. */
export async function findRole(testApp: TestApp, name: string): Promise<Role> {
  const role = await testApp.app.get(RolesRepository).findByName(name);
  if (!role) throw new Error(`No role is named ${name}; seed the system roles first`);
  return role;
}

/** A verified user with the `user` role (or the given `roleIds`), created directly. Seed the system roles first. */
export async function createUser(
  testApp: TestApp,
  overrides: Partial<NewTestUser> = {},
): Promise<User> {
  const userRole = await findRole(testApp, SystemRoleName.User);
  const user: NewTestUser = {
    email: 'ada@example.com',
    password: TEST_PASSWORD,
    name: 'Ada Lovelace',
    roleIds: [userRole.id],
    emailVerified: true,
    ...overrides,
  };
  return testApp.app.get(UsersRepository).create({
    email: normalizeEmail(user.email),
    passwordHash: await testApp.app.get(PasswordHasher).hash(user.password),
    name: user.name,
    emailVerifiedAt: user.emailVerified ? new Date() : null,
    roleIds: user.roleIds,
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
  overrides: Partial<NewTestUser> = {},
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
