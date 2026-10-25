import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PasswordHasher } from '../../auth/password-hasher.js';
import { ErrorCode } from '../../common/error-code.js';
import type { Page } from '../../common/pagination.js';
import { RolesRepository } from '../roles/roles.repository.js';
import { SessionsService } from '../sessions/sessions.service.js';
import { normalizeEmail } from './email.js';
import type { User } from './user.js';
import {
  UnknownRoleIdsException,
  type UserChanges,
  type UserListQuery,
  UsersRepository,
} from './users.repository.js';

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  roleIds?: string[];
  emailVerified?: boolean;
}

export type UpdateUserInput = Partial<CreateUserInput>;

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly roles: RolesRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessions: SessionsService,
  ) {}

  async listUsers(query: UserListQuery): Promise<Page<User>> {
    const { items, total } = await this.users.list(query);
    return { items, total, page: query.page, limit: query.limit };
  }

  async getUser(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw userNotFound();
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(normalizeEmail(email));
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const roleIds = distinct(input.roleIds ?? []);
    await this.assertRolesExist(roleIds);
    return this.users.create({
      email: normalizeEmail(input.email),
      passwordHash: await this.passwordHasher.hash(input.password),
      name: input.name,
      emailVerifiedAt: input.emailVerified ? new Date() : null,
      roleIds,
    });
  }

  /** A new password signs the user out of every session. */
  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const user = await this.users.update(id, await this.toChanges(input));
    if (!user) throw userNotFound();
    if (input.password !== undefined) {
      await this.sessions.revokeAllForUser(id);
    }
    return user;
  }

  /** The user's own password change: signs out every session except the one they made it from. */
  async changePassword(id: string, newPassword: string, keepSessionId: string): Promise<void> {
    const passwordHash = await this.passwordHasher.hash(newPassword);
    if (!(await this.users.update(id, { passwordHash }))) throw userNotFound();
    await this.sessions.revokeAllForUser(id, { except: keepSessionId });
  }

  /** Signs the user out everywhere, then deletes them. `actorId` is the admin doing it. */
  /** Marks the user's email as verified, keeping the original time if it already was. */
  async markEmailVerified(id: string): Promise<void> {
    const user = await this.users.findById(id);
    if (!user) throw userNotFound();
    if (user.emailVerifiedAt === null) {
      await this.users.update(id, { emailVerifiedAt: new Date() });
    }
  }

  async deleteUser(id: string, actorId: string): Promise<void> {
    if (id === actorId) {
      throw new ConflictException("You can't delete your own account", {
        errorCode: ErrorCode.UserCannotDeleteSelf,
      });
    }
    await this.sessions.revokeAllForUser(id);
    if (!(await this.users.delete(id))) throw userNotFound();
  }

  private async toChanges(input: UpdateUserInput): Promise<UserChanges> {
    const changes: UserChanges = {};
    if (input.email !== undefined) changes.email = normalizeEmail(input.email);
    if (input.name !== undefined) changes.name = input.name;
    if (input.password !== undefined) {
      changes.passwordHash = await this.passwordHasher.hash(input.password);
    }
    if (input.emailVerified !== undefined) {
      changes.emailVerifiedAt = input.emailVerified ? new Date() : null;
    }
    if (input.roleIds !== undefined) {
      changes.roleIds = distinct(input.roleIds);
      await this.assertRolesExist(changes.roleIds);
    }
    return changes;
  }

  private async assertRolesExist(roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) return;
    const found = new Set((await this.roles.findByIds(roleIds)).map((role) => role.id));
    const unknownIds = roleIds.filter((id) => !found.has(id));
    if (unknownIds.length > 0) throw new UnknownRoleIdsException(unknownIds);
  }
}

function distinct(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function userNotFound(): NotFoundException {
  return new NotFoundException('User not found');
}
