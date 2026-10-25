import { Injectable } from '@nestjs/common';
import { asc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
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
import { type Database, InjectDatabase } from '../database.js';
import {
  containsPattern,
  firstRow,
  isForeignKeyViolation,
  isUniqueViolation,
} from '../query-helpers.js';
import { roles } from '../schema/roles.js';
import { USER_ROLES_ROLE_FK, USERS_EMAIL_UNIQUE, userRoles, users } from '../schema/users.js';

type UserRow = typeof users.$inferSelect;

/** What the role-assignment writes need; satisfied by the database and by a transaction. */
type RoleAssignmentExecutor = Pick<Database, 'insert' | 'delete'>;

@Injectable()
export class DrizzleUsersRepository implements UsersRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id));
    const [user] = await this.withRoles(rows);
    return user ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.email, email));
    const [user] = await this.withRoles(rows);
    return user ?? null;
  }

  async list({ page, limit, search }: UserListQuery): Promise<UserList> {
    const matching = search === undefined ? undefined : emailOrNameContains(search);
    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(users)
        .where(matching)
        .orderBy(asc(users.email))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.$count(users, matching),
    ]);
    return { items: await this.withRoles(rows), total };
  }

  async create({ roleIds, ...fields }: NewUser): Promise<User> {
    const row = await this.mapConstraintViolations(roleIds, () =>
      this.db.transaction(async (tx) => {
        const created = firstRow(await tx.insert(users).values(fields).returning());
        await this.assignRoles(tx, created.id, roleIds);
        return created;
      }),
    );
    return firstRow(await this.withRoles([row]));
  }

  async update(id: string, { roleIds, ...fields }: UserChanges): Promise<User | null> {
    const row = await this.mapConstraintViolations(roleIds ?? [], () =>
      this.db.transaction(async (tx) => {
        // Updating the row first locks it, so concurrent role changes to one user run one after the other.
        const [updated] = await tx
          .update(users)
          .set({ ...fields, updatedAt: new Date() })
          .where(eq(users.id, id))
          .returning();
        if (updated && roleIds) {
          await tx.delete(userRoles).where(eq(userRoles.userId, id));
          await this.assignRoles(tx, id, roleIds);
        }
        return updated;
      }),
    );
    if (!row) return null;
    return firstRow(await this.withRoles([row]));
  }

  async delete(id: string): Promise<boolean> {
    // Their sessions and user_roles rows go with them (on delete cascade).
    const deleted = await this.db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    return deleted.length > 0;
  }

  private async assignRoles(
    executor: RoleAssignmentExecutor,
    userId: string,
    roleIds: string[],
  ): Promise<void> {
    if (roleIds.length === 0) return;
    await executor.insert(userRoles).values(roleIds.map((roleId) => ({ userId, roleId })));
  }

  /** Loads the roles of every row in one query. */
  private async withRoles(rows: UserRow[]): Promise<User[]> {
    if (rows.length === 0) return [];
    const assignments = await this.db
      .select({
        userId: userRoles.userId,
        id: roles.id,
        name: roles.name,
        permissions: roles.permissions,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        inArray(
          userRoles.userId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(asc(roles.name));

    return rows.map((row) => {
      const userRolesOfRow: UserRole[] = assignments
        .filter((assignment) => assignment.userId === row.id)
        .map(({ id, name, permissions }) => ({ id, name, permissions }));
      return { ...row, roles: userRolesOfRow };
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
      if (isUniqueViolation(error, USERS_EMAIL_UNIQUE)) throw new UserEmailTakenException();
      if (isForeignKeyViolation(error, USER_ROLES_ROLE_FK)) {
        throw new UnknownRoleIdsException(roleIds);
      }
      throw error;
    }
  }
}

function emailOrNameContains(search: string): SQL | undefined {
  const pattern = containsPattern(search);
  return or(ilike(users.email, pattern), ilike(users.name, pattern));
}
