import type { Role } from '../../src/modules/roles/role.js';
import type { Session } from '../../src/modules/sessions/session.js';
import type { User } from '../../src/modules/users/user.js';

/** A user row: roles are referenced by id, like the `user_roles` table. */
export interface StoredUser extends Omit<User, 'roles'> {
  roleIds: string[];
}

/**
 * The tables the in-memory repositories share, so that deleting a role or a user
 * cascades the way the database's foreign keys do.
 */
export class InMemoryStore {
  readonly users = new Map<string, StoredUser>();
  readonly roles = new Map<string, Role>();
  readonly sessions = new Map<string, Session>();
}
