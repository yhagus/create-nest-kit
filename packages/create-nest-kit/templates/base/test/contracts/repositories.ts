import { Permission } from '../../src/modules/permissions/permission.js';
import type { NewRole, RolesRepository } from '../../src/modules/roles/roles.repository.js';
import type {
  NewSession,
  SessionsRepository,
} from '../../src/modules/sessions/sessions.repository.js';
import type { NewUser, UsersRepository } from '../../src/modules/users/users.repository.js';

export interface Repositories {
  users: UsersRepository;
  roles: RolesRepository;
  sessions: SessionsRepository;
}

/** Called before each contract test; returns repositories over an empty store. */
export type RepositoriesFactory = () => Promise<Repositories>;

const HOUR_MS = 3_600_000;

/** A well-formed UUIDv7 that no store contains. */
export const UNKNOWN_ID = '01900000-0000-7000-8000-000000000000';

/** A fixed clock reading, so session tests don't depend on the time they run at. */
export const NOW = new Date('2026-01-15T12:00:00.000Z');

export function hoursFrom(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * HOUR_MS);
}

export function aRole(overrides: Partial<NewRole> = {}): NewRole {
  return {
    name: 'editor',
    description: 'Edits content',
    permissions: [Permission.UsersRead],
    isSystem: false,
    ...overrides,
  };
}

export function aUser(overrides: Partial<NewUser> = {}): NewUser {
  return {
    email: 'ada@example.com',
    passwordHash: 'hash',
    name: 'Ada Lovelace',
    emailVerifiedAt: null,
    roleIds: [],
    ...overrides,
  };
}

export function aSession(userId: string, overrides: Partial<NewSession> = {}): NewSession {
  return {
    userId,
    userAgent: 'Mozilla/5.0',
    ip: '203.0.113.7',
    createdAt: NOW,
    expiresAt: hoursFrom(NOW, 24),
    absoluteExpiresAt: hoursFrom(NOW, 72),
    ...overrides,
  };
}
