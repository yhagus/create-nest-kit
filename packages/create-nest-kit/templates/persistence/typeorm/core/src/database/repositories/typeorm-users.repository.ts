import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, type FindOptionsWhere, ILike, In, Repository } from 'typeorm';
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
import { USER_ROLES_ROLE_FK, UserRoleEntity } from '../entities/user-role.entity.js';
import { USERS_EMAIL_UNIQUE, UserEntity } from '../entities/user.entity.js';
import {
  containsPattern,
  isForeignKeyViolation,
  isUniqueViolation,
  returnedEntities,
} from '../query-helpers.js';

@Injectable()
export class TypeOrmUsersRepository implements UsersRepository {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(UserRoleEntity) private readonly userRoles: Repository<UserRoleEntity>,
  ) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.users.findOneBy({ id });
    return row && this.withRoles(row);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.users.findOneBy({ email });
    return row && this.withRoles(row);
  }

  async list({ page, limit, search }: UserListQuery): Promise<UserList> {
    const [rows, total] = await this.users.findAndCount({
      where: search === undefined ? {} : emailOrNameContains(search),
      order: { email: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: await this.withRolesOfEach(rows), total };
  }

  async create({ roleIds, ...fields }: NewUser): Promise<User> {
    const user = this.users.create({ id: uuidv7(), ...fields });
    await this.mapConstraintViolations(roleIds, () =>
      this.users.manager.transaction(async (manager) => {
        // Fills in the columns the database defaults, like createdAt.
        await manager.insert(UserEntity, user);
        await assignRoles(manager, user.id, roleIds);
      }),
    );
    return this.withRoles(user);
  }

  async update(id: string, { roleIds, ...fields }: UserChanges): Promise<User | null> {
    const row = await this.mapConstraintViolations(roleIds ?? [], () =>
      this.users.manager.transaction(async (manager) => {
        const users = manager.getRepository(UserEntity);
        // Updating the row first locks it, so concurrent role changes to one user run one after the other.
        const result = await users
          .createQueryBuilder()
          .update()
          .set(fields)
          .where({ id })
          .returning('*')
          .execute();
        const [updated] = returnedEntities(users, result);
        if (updated && roleIds) {
          await manager.delete(UserRoleEntity, { userId: id });
          await assignRoles(manager, id, roleIds);
        }
        return updated;
      }),
    );
    return row ? this.withRoles(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    // Their sessions and user_roles rows go with them (on delete cascade).
    const { affected } = await this.users.delete({ id });
    return affected === 1;
  }

  private async withRoles(row: UserEntity): Promise<User> {
    const [user] = await this.withRolesOfEach([row]);
    if (!user) throw new Error('Expected the user with its roles');
    return user;
  }

  /** Loads the roles of every row in one query. */
  private async withRolesOfEach(rows: UserEntity[]): Promise<User[]> {
    if (rows.length === 0) return [];
    const assignments = await this.userRoles.find({
      where: { userId: In(rows.map((row) => row.id)) },
      relations: { role: true },
      order: { role: { name: 'ASC' } },
    });

    return rows.map((row) => {
      const rolesOfRow: UserRole[] = assignments
        .filter((assignment) => assignment.userId === row.id)
        .map(({ role: { id, name, permissions } }) => ({ id, name, permissions }));
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
      if (isUniqueViolation(error, USERS_EMAIL_UNIQUE)) throw new UserEmailTakenException();
      if (isForeignKeyViolation(error, USER_ROLES_ROLE_FK)) {
        throw new UnknownRoleIdsException(roleIds);
      }
      throw error;
    }
  }
}

async function assignRoles(
  manager: EntityManager,
  userId: string,
  roleIds: readonly string[],
): Promise<void> {
  if (roleIds.length === 0) return;
  await manager.insert(
    UserRoleEntity,
    roleIds.map((roleId) => ({ userId, roleId })),
  );
}

/** Either column matching is enough: TypeORM joins the array's conditions with OR. */
function emailOrNameContains(search: string): FindOptionsWhere<UserEntity>[] {
  const pattern = containsPattern(search);
  return [{ email: ILike(pattern) }, { name: ILike(pattern) }];
}
