import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { Connection, Model, QueryFilter } from 'mongoose';
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
import { CascadeDelete } from '../dependent-documents.js';
import { containsIgnoringCase, isDuplicateKey } from '../query-helpers.js';
import { RoleRecord } from '../schemas/role.schema.js';
import { SessionRecord } from '../schemas/session.schema.js';
import { UserRecord } from '../schemas/user.schema.js';

/**
 * Users keep their role ids in `roleIds`. MongoDB has no foreign key to reject an unknown id,
 * so every write that sets roles checks them twice:
 * - before writing, so a role that is already gone is rejected and nothing is stored;
 * - after writing, so a role deleted while the write ran is pruned again. Either the role was
 *   still there at that second read, and its deletion's `$pull` comes later and finds this user,
 *   or it was gone, and this repository does the `$pull` itself.
 */
@Injectable()
export class MongooseUsersRepository implements UsersRepository {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(UserRecord.name) private readonly users: Model<UserRecord>,
    @InjectModel(RoleRecord.name) private readonly roles: Model<RoleRecord>,
    @InjectModel(SessionRecord.name) private readonly sessions: Model<SessionRecord>,
    private readonly cascade: CascadeDelete,
  ) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.users.findById(id).lean();
    return record && this.withRoles(record);
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.users.findOne({ email }).lean();
    return record && this.withRoles(record);
  }

  async list({ page, limit, search }: UserListQuery): Promise<UserList> {
    const filter = search === undefined ? {} : emailOrNameContains(search);
    const [records, total] = await Promise.all([
      this.users
        .find(filter)
        .sort({ email: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.users.countDocuments(filter),
    ]);
    return { items: await this.withRolesOfEach(records), total };
  }

  async create(newUser: NewUser): Promise<User> {
    await this.assertRolesExist(newUser.roleIds);
    const created = await this.mapEmailTaken(() => this.users.create(newUser));
    return this.withRolesPruningDeleted(created.toObject());
  }

  async update(id: string, changes: UserChanges): Promise<User | null> {
    if (changes.roleIds) await this.assertRolesExist(changes.roleIds);
    // Mongoose leaves out the fields that are undefined, so they keep their values.
    const record = await this.mapEmailTaken(() =>
      this.users.findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after' }).lean(),
    );
    return record && this.withRolesPruningDeleted(record);
  }

  delete(id: string): Promise<boolean> {
    return this.connection.transaction(async (session) => {
      const { deletedCount } = await this.users.deleteOne({ _id: id }, { session });
      if (deletedCount === 0) return false;

      const userSessions = await this.sessions
        .find({ userId: id }, { _id: 1 })
        .session(session)
        .lean();
      const sessionIds = userSessions.map((userSession) => userSession._id);
      await this.sessions.deleteMany({ userId: id }, { session });
      await this.cascade.deleteForSessions(sessionIds, session);
      await this.cascade.deleteForUsers([id], session);
      return true;
    });
  }

  private async assertRolesExist(roleIds: readonly string[]): Promise<void> {
    const existing = await this.existingRoleIds(roleIds);
    const unknownIds = roleIds.filter((roleId) => !existing.has(roleId));
    if (unknownIds.length > 0) throw new UnknownRoleIdsException(unknownIds);
  }

  private async existingRoleIds(roleIds: readonly string[]): Promise<Set<string>> {
    if (roleIds.length === 0) return new Set();
    const records = await this.roles.find({ _id: { $in: roleIds } }, { _id: 1 }).lean();
    return new Set(records.map((record) => record._id));
  }

  /** The user with their roles, after removing the ids of roles deleted since the write. */
  private async withRolesPruningDeleted(record: UserRecord): Promise<User> {
    const user = await this.withRoles(record);
    const remainingIds = new Set(user.roles.map((role) => role.id));
    const deletedIds = record.roleIds.filter((roleId) => !remainingIds.has(roleId));
    if (deletedIds.length > 0) {
      await this.users.updateOne(
        { _id: record._id },
        { $pull: { roleIds: { $in: deletedIds } } },
        { timestamps: false },
      );
    }
    return user;
  }

  private async withRoles(record: UserRecord): Promise<User> {
    const [user] = await this.withRolesOfEach([record]);
    if (!user) throw new Error('Expected the user with its roles');
    return user;
  }

  /** Loads the roles of every record in one query. Ids of deleted roles are skipped. */
  private async withRolesOfEach(records: UserRecord[]): Promise<User[]> {
    const roleIds = [...new Set(records.flatMap((record) => record.roleIds))];
    const roleRecords =
      roleIds.length === 0
        ? []
        : await this.roles
            .find({ _id: { $in: roleIds } })
            .sort({ name: 1 })
            .lean();

    return records.map((record) => {
      const roles: UserRole[] = roleRecords
        .filter((role) => record.roleIds.includes(role._id))
        .map((role) => ({ id: role._id, name: role.name, permissions: [...role.permissions] }));
      return toUser(record, roles);
    });
  }

  private async mapEmailTaken<Result>(write: () => Promise<Result>): Promise<Result> {
    try {
      return await write();
    } catch (error) {
      if (isDuplicateKey(error, 'email')) throw new UserEmailTakenException();
      throw error;
    }
  }
}

function toUser(record: UserRecord, roles: UserRole[]): User {
  return {
    id: record._id,
    email: record.email,
    passwordHash: record.passwordHash,
    name: record.name,
    emailVerifiedAt: record.emailVerifiedAt ?? null,
    roles,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function emailOrNameContains(search: string): QueryFilter<UserRecord> {
  const pattern = containsIgnoringCase(search);
  return { $or: [{ email: pattern }, { name: pattern }] };
}
