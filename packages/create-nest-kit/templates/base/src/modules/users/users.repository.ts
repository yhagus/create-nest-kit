import { BadRequestException, ConflictException } from '@nestjs/common';
import { ErrorCode } from '../../common/error-code.js';
import type { FieldError } from '../../common/field-error.js';
import type { User } from './user.js';

export interface NewUser {
  email: string;
  passwordHash: string;
  name: string;
  emailVerifiedAt: Date | null;
  roleIds: string[];
}

/** Fields left `undefined` stay as they are. `roleIds` replaces the user's roles. */
export type UserChanges = Partial<NewUser>;

export const USER_SEARCH_MAX_LENGTH = 100;

export interface UserListQuery {
  page: number;
  limit: number;
  /** Case-insensitive substring of the email or the name. */
  search?: string;
}

export interface UserList {
  items: User[];
  total: number;
}

/** Thrown by `create` and `update` when the store's unique constraint on the email rejects the write. */
export class UserEmailTakenException extends ConflictException {
  constructor() {
    super('Email is already in use', { errorCode: ErrorCode.UserEmailTaken });
  }
}

/**
 * A validation error on `roleIds`. Thrown by `create` and `update` when the store rejects a
 * role id, e.g. one whose role was deleted while the write ran.
 */
export class UnknownRoleIdsException extends BadRequestException {
  constructor(roleIds: readonly string[]) {
    const details: FieldError[] = [
      { field: 'roleIds', errors: [`unknown role ids: ${roleIds.join(', ')}`] },
    ];
    super({ message: 'Validation failed', details }, { errorCode: ErrorCode.ValidationFailed });
  }
}

/**
 * Where users and their role assignments are stored. Emails arrive normalized.
 * The persistence layer binds the implementation in `src/database/database.module.ts`;
 * `test/contracts/users-repository.contract.ts` is its spec.
 */
export abstract class UsersRepository {
  abstract findById(id: string): Promise<User | null>;

  abstract findByEmail(email: string): Promise<User | null>;

  /** One page of users, ordered by email, with the number of users matching `search`. */
  abstract list(query: UserListQuery): Promise<UserList>;

  /** @throws UserEmailTakenException, UnknownRoleIdsException */
  abstract create(user: NewUser): Promise<User>;

  /** Null when there is no such user. @throws UserEmailTakenException, UnknownRoleIdsException */
  abstract update(id: string, changes: UserChanges): Promise<User | null>;

  /** Their sessions and role assignments go with them. False when there is no such user. */
  abstract delete(id: string): Promise<boolean>;
}
