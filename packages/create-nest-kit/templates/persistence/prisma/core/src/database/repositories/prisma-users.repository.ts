import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import type { Prisma } from '../../generated/prisma/client.js';
import type { User } from '../../modules/users/user.js';
import {
  type NewUser,
  UnknownRoleIdsException,
  type UserChanges,
  UserEmailTakenException,
  type UserList,
  type UserListQuery,
  UsersRepository,
} from '../../modules/users/users.repository.js';
import { toPermissions } from '../permissions.js';
import { PrismaService } from '../prisma.service.js';
import {
  isForeignKeyViolation,
  isRecordNotFound,
  isUniqueViolation,
  literalContains,
} from '../query-helpers.js';

/** Named in prisma/schema/users.prisma and roles.prisma. */
const USERS_EMAIL_UNIQUE = 'users_email_key';
const USER_ROLES_ROLE_FK = 'user_roles_role_id_fkey';

/** Loads a user's roles with them, ordered by name. */
const WITH_ROLES = {
  roles: {
    select: { role: { select: { id: true, name: true, permissions: true } } },
    orderBy: { role: { name: 'asc' } },
  },
} satisfies Prisma.UserInclude;

type UserRow = Prisma.UserGetPayload<{ include: typeof WITH_ROLES }>;

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id }, include: WITH_ROLES });
    return row && toUser(row);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email }, include: WITH_ROLES });
    return row && toUser(row);
  }

  async list({ page, limit, search }: UserListQuery): Promise<UserList> {
    const where = search === undefined ? undefined : emailOrNameContains(search);
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: WITH_ROLES,
        orderBy: { email: 'asc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: rows.map(toUser), total };
  }

  create({ roleIds, ...fields }: NewUser): Promise<User> {
    // A nested write: Prisma inserts the user and their role assignments in one transaction.
    return this.mapConstraintViolations(roleIds, async () => {
      const row = await this.prisma.user.create({
        data: { id: uuidv7(), ...fields, roles: { create: roleIds.map((roleId) => ({ roleId })) } },
        include: WITH_ROLES,
      });
      return toUser(row);
    });
  }

  update(id: string, { roleIds, ...fields }: UserChanges): Promise<User | null> {
    const replaceRoles =
      roleIds === undefined
        ? undefined
        : { deleteMany: {}, create: roleIds.map((roleId) => ({ roleId })) };

    return this.mapConstraintViolations(roleIds ?? [], async () => {
      try {
        const row = await this.prisma.user.update({
          where: { id },
          data: { ...fields, roles: replaceRoles },
          include: WITH_ROLES,
        });
        return toUser(row);
      } catch (error) {
        if (isRecordNotFound(error)) return null;
        throw error;
      }
    });
  }

  async delete(id: string): Promise<boolean> {
    // Their sessions and user_roles rows go with them (on delete cascade).
    const { count } = await this.prisma.user.deleteMany({ where: { id } });
    return count > 0;
  }

  /** The service checks role ids first, but a role can still be deleted before the write commits. */
  private async mapConstraintViolations<Result>(
    roleIds: readonly string[],
    write: () => Promise<Result>,
  ): Promise<Result> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueViolation(error, USERS_EMAIL_UNIQUE)) throw new UserEmailTakenException();
      if (isForeignKeyViolation(error, USER_ROLES_ROLE_FK)) {
        throw new UnknownRoleIdsException(roleIds);
      }
      throw error;
    }
  }
}

function emailOrNameContains(search: string): Prisma.UserWhereInput {
  const contains = { contains: literalContains(search), mode: 'insensitive' } as const;
  return { OR: [{ email: contains }, { name: contains }] };
}

function toUser({ roles, ...fields }: UserRow): User {
  return {
    ...fields,
    roles: roles.map(({ role }) => ({ ...role, permissions: toPermissions(role.permissions) })),
  };
}
