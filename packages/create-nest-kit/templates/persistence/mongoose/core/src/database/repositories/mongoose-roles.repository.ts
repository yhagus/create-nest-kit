import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Role } from '../../modules/roles/role.js';
import {
  type NewRole,
  type RoleChanges,
  RoleNameTakenException,
  RolesRepository,
} from '../../modules/roles/roles.repository.js';
import { isDuplicateKey } from '../query-helpers.js';
import { RoleRecord } from '../schemas/role.schema.js';
import { UserRecord } from '../schemas/user.schema.js';

@Injectable()
export class MongooseRolesRepository implements RolesRepository {
  constructor(
    @InjectModel(RoleRecord.name) private readonly roles: Model<RoleRecord>,
    @InjectModel(UserRecord.name) private readonly users: Model<UserRecord>,
  ) {}

  async findAll(): Promise<Role[]> {
    const records = await this.roles.find().sort({ name: 1 }).lean();
    return records.map(toRole);
  }

  async findById(id: string): Promise<Role | null> {
    const record = await this.roles.findById(id).lean();
    return record && toRole(record);
  }

  async findByName(name: string): Promise<Role | null> {
    const record = await this.roles.findOne({ name }).lean();
    return record && toRole(record);
  }

  async findByIds(ids: readonly string[]): Promise<Role[]> {
    if (ids.length === 0) return [];
    const records = await this.roles.find({ _id: { $in: ids } }).lean();
    return records.map(toRole);
  }

  create(newRole: NewRole): Promise<Role> {
    return this.mapNameTaken(async () => {
      const created = await this.roles.create(newRole);
      return toRole(created.toObject());
    });
  }

  update(id: string, changes: RoleChanges): Promise<Role | null> {
    return this.mapNameTaken(async () => {
      // Mongoose leaves out the fields that are undefined, so they keep their values.
      const record = await this.roles
        .findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after' })
        .lean();
      return record && toRole(record);
    });
  }

  /**
   * Two writes, not a transaction: a user write that runs between them prunes the deleted role
   * itself (see `MongooseUsersRepository`), and a transaction's snapshot would hide that user
   * from the `$pull`. Until the `$pull` runs, readers skip the id, because a user's roles are
   * looked up by id.
   */
  async delete(id: string): Promise<boolean> {
    const { deletedCount } = await this.roles.deleteOne({ _id: id });
    if (deletedCount === 0) return false;

    // Taking a role away is not an edit of the user, so updatedAt stays.
    await this.users.updateMany({ roleIds: id }, { $pull: { roleIds: id } }, { timestamps: false });
    return true;
  }

  private async mapNameTaken<Result>(write: () => Promise<Result>): Promise<Result> {
    try {
      return await write();
    } catch (error) {
      if (isDuplicateKey(error, 'name')) throw new RoleNameTakenException();
      throw error;
    }
  }
}

function toRole(record: RoleRecord): Role {
  return {
    id: record._id,
    name: record.name,
    description: record.description,
    permissions: [...record.permissions],
    isSystem: record.isSystem,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
