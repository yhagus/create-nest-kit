import { randomUUID } from 'node:crypto';
import type { User, UserRole } from '../../src/modules/users/user.js';
import {
  type NewUser,
  UnknownRoleIdsException,
  type UserChanges,
  UserEmailTakenException,
  type UserList,
  type UserListQuery,
  type UsersRepository,
} from '../../src/modules/users/users.repository.js';
import type { InMemoryStore, StoredUser } from './in-memory-store.js';

export class InMemoryUsersRepository implements UsersRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findById(id: string): Promise<User | null> {
    const user = this.store.users.get(id);
    return user ? this.toUser(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = [...this.store.users.values()].find((candidate) => candidate.email === email);
    return user ? this.toUser(user) : null;
  }

  async list({ page, limit, search }: UserListQuery): Promise<UserList> {
    const term = search?.toLowerCase();
    const matching = [...this.store.users.values()]
      .filter(
        (user) =>
          term === undefined ||
          user.email.toLowerCase().includes(term) ||
          user.name.toLowerCase().includes(term),
      )
      .toSorted((a, b) => a.email.localeCompare(b.email));
    const offset = (page - 1) * limit;
    return {
      items: matching.slice(offset, offset + limit).map((user) => this.toUser(user)),
      total: matching.length,
    };
  }

  async create(newUser: NewUser): Promise<User> {
    this.assertEmailIsFree(newUser.email);
    this.assertRolesExist(newUser.roleIds);
    const now = new Date();
    const user: StoredUser = {
      ...structuredClone(newUser),
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.store.users.set(user.id, user);
    return this.toUser(user);
  }

  async update(id: string, changes: UserChanges): Promise<User | null> {
    const existing = this.store.users.get(id);
    if (!existing) return null;
    if (changes.email !== undefined && changes.email !== existing.email) {
      this.assertEmailIsFree(changes.email);
    }
    if (changes.roleIds) this.assertRolesExist(changes.roleIds);
    const user: StoredUser = {
      ...existing,
      email: changes.email ?? existing.email,
      passwordHash: changes.passwordHash ?? existing.passwordHash,
      name: changes.name ?? existing.name,
      emailVerifiedAt:
        changes.emailVerifiedAt === undefined ? existing.emailVerifiedAt : changes.emailVerifiedAt,
      roleIds: changes.roleIds ? [...changes.roleIds] : existing.roleIds,
      updatedAt: new Date(),
    };
    this.store.users.set(id, user);
    return this.toUser(user);
  }

  async delete(id: string): Promise<boolean> {
    if (!this.store.users.delete(id)) return false;
    for (const session of this.store.sessions.values()) {
      if (session.userId === id) this.store.sessions.delete(session.id);
    }
    return true;
  }

  private assertEmailIsFree(email: string): void {
    if ([...this.store.users.values()].some((user) => user.email === email)) {
      throw new UserEmailTakenException();
    }
  }

  private assertRolesExist(roleIds: readonly string[]): void {
    const unknownIds = roleIds.filter((roleId) => !this.store.roles.has(roleId));
    if (unknownIds.length > 0) throw new UnknownRoleIdsException(unknownIds);
  }

  private toUser({ roleIds, ...user }: StoredUser): User {
    const roles: UserRole[] = [];
    for (const roleId of roleIds) {
      const role = this.store.roles.get(roleId);
      if (role) roles.push({ id: role.id, name: role.name, permissions: [...role.permissions] });
    }
    return {
      ...structuredClone(user),
      roles: roles.toSorted((a, b) => a.name.localeCompare(b.name)),
    };
  }
}
