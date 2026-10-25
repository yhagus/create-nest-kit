import type { FilterQuery } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import type { User, UserRole } from '../../modules/users/user.js';
import {
  type NewUser,
  UnknownRoleIdsException,
  type UserChanges,
  UserEmailTakenException,
  type UserList,
  type UserListQuery,
  UsersRepository,
} from '../../modules/users/users.repository.js';
import { RoleEntity } from '../entities/role.entity.js';
import { USER_ROLES_ROLE_FK, UserRoleEntity } from '../entities/user-role.entity.js';
import { USERS_EMAIL_UNIQUE, UserEntity } from '../entities/user.entity.js';
import {
  containsPattern,
  definedFields,
  isForeignKeyViolation,
  isUniqueViolation,
  toDriverException,
} from '../query-helpers.js';

/** A user row, before its roles are attached. */
type UserRow = Omit<User, 'roles'>;

/**
 * Every method runs on its own fork of the EntityManager, so it works outside an HTTP request
 * (queue jobs, the seed, tests) and never reads a stale row from a shared identity map.
 */
@Injectable()
export class MikroOrmUsersRepository implements UsersRepository {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.em.fork().findOne(UserEntity, { id });
    return row && this.withRoles(row);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.em.fork().findOne(UserEntity, { email });
    return row && this.withRoles(row);
  }

  async list({ page, limit, search }: UserListQuery): Promise<UserList> {
    const [rows, total] = await this.em
      .fork()
      .findAndCount(UserEntity, search === undefined ? {} : emailOrNameContains(search), {
        orderBy: { email: 'asc' },
        offset: (page - 1) * limit,
        limit,
      });
    return { items: await this.withRolesOfEach(rows), total };
  }

  async create({ roleIds, ...fields }: NewUser): Promise<User> {
    const now = new Date();
    const user: UserRow = { id: uuidv7(), ...fields, createdAt: now, updatedAt: now };
    await this.mapConstraintViolations(roleIds, () =>
      this.em.fork().transactional(async (em) => {
        await em.insert(UserEntity, user);
        await assignRoles(em, user.id, roleIds);
      }),
    );
    return this.withRoles(user);
  }

  async update(id: string, { roleIds, ...fields }: UserChanges): Promise<User | null> {
    const row = await this.mapConstraintViolations(roleIds ?? [], () =>
      this.em.fork().transactional(async (em) => {
        // Updating the row first locks it, so concurrent role changes to one user run one after the other.
        const [updated] = await em
          .createQueryBuilder(UserEntity)
          .update({ ...definedFields(fields), updatedAt: new Date() })
          .where({ id })
          .returning('*')
          .execute<UserRow[]>('all');
        if (updated && roleIds) {
          await em.nativeDelete(UserRoleEntity, { userId: id });
          await assignRoles(em, id, roleIds);
        }
        return updated;
      }),
    );
    return row ? this.withRoles(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    // Their sessions and user_roles rows go with them (on delete cascade).
    const deleted = await this.em.fork().nativeDelete(UserEntity, { id });
    return deleted === 1;
  }

  private async withRoles(row: UserRow): Promise<User> {
    const [user] = await this.withRolesOfEach([row]);
    if (!user) throw new Error('Expected the user with its roles');
    return user;
  }

  /** Loads the roles of every row in two queries: the assignments, then their roles by name. */
  private async withRolesOfEach(rows: UserRow[]): Promise<User[]> {
    if (rows.length === 0) return [];
    const em = this.em.fork();
    const assignments = await em.find(UserRoleEntity, {
      userId: { $in: rows.map((row) => row.id) },
    });
    const roles = await em.find(
      RoleEntity,
      { id: { $in: assignments.map((assignment) => assignment.roleId) } },
      { orderBy: { name: 'asc' } },
    );

    return rows.map((row) => {
      const roleIdsOfRow = new Set(
        assignments
          .filter((assignment) => assignment.userId === row.id)
          .map((assignment) => assignment.roleId),
      );
      const rolesOfRow: UserRole[] = roles
        .filter((role) => roleIdsOfRow.has(role.id))
        .map(({ id, name, permissions }) => ({ id, name, permissions }));
      return { ...row, roles: rolesOfRow };
    });
  }

  /** The service checks role ids first, but a role can still be deleted before the write commits. */
  private async mapConstraintViolations<Result>(
    roleIds: readonly string[],
    write: () => Promise<Result>,
  ): Promise<Result> {
    try {
      return await write();
    } catch (error) {
      const exception = toDriverException(this.em, error);
      if (isUniqueViolation(exception, USERS_EMAIL_UNIQUE)) throw new UserEmailTakenException();
      if (isForeignKeyViolation(exception, USER_ROLES_ROLE_FK)) {
        throw new UnknownRoleIdsException(roleIds);
      }
      throw exception;
    }
  }
}

async function assignRoles(
  em: EntityManager,
  userId: string,
  roleIds: readonly string[],
): Promise<void> {
  if (roleIds.length === 0) return;
  await em.insertMany(
    UserRoleEntity,
    roleIds.map((roleId) => ({ userId, roleId })),
  );
}

function emailOrNameContains(search: string): FilterQuery<UserEntity> {
  const pattern = containsPattern(search);
  return { $or: [{ email: { $ilike: pattern } }, { name: { $ilike: pattern } }] };
}
