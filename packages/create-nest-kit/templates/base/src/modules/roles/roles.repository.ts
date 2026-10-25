import { ConflictException } from '@nestjs/common';
import { ErrorCode } from '../../common/error-code.js';
import type { Role } from './role.js';

export type NewRole = Pick<Role, 'name' | 'description' | 'permissions' | 'isSystem'>;

export type RoleChanges = Partial<Pick<Role, 'name' | 'description' | 'permissions'>>;

/** Thrown by `create` and `update` when the store's unique constraint on the name rejects the write. */
export class RoleNameTakenException extends ConflictException {
  constructor() {
    super('Role name is already in use', { errorCode: ErrorCode.RoleNameTaken });
  }
}

/**
 * Where roles are stored. The persistence layer binds the implementation in
 * `src/database/database.module.ts`; `test/contracts/roles-repository.contract.ts` is its spec.
 */
export abstract class RolesRepository {
  /** Every role, ordered by name. */
  abstract findAll(): Promise<Role[]>;

  abstract findById(id: string): Promise<Role | null>;

  abstract findByName(name: string): Promise<Role | null>;

  /** The roles among `ids` that exist; unknown ids are left out. */
  abstract findByIds(ids: readonly string[]): Promise<Role[]>;

  /** @throws RoleNameTakenException */
  abstract create(role: NewRole): Promise<Role>;

  /** Null when there is no such role. @throws RoleNameTakenException */
  abstract update(id: string, changes: RoleChanges): Promise<Role | null>;

  /** Also takes the role away from every user. False when there is no such role. */
  abstract delete(id: string): Promise<boolean>;
}
