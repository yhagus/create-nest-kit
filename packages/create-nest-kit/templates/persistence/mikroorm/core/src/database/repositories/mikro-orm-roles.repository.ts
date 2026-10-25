import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import type { Role } from '../../modules/roles/role.js';
import {
  type NewRole,
  type RoleChanges,
  RoleNameTakenException,
  RolesRepository,
} from '../../modules/roles/roles.repository.js';
import { ROLES_NAME_UNIQUE, RoleEntity } from '../entities/role.entity.js';
import { definedFields, isUniqueViolation, toDriverException } from '../query-helpers.js';

/**
 * Every method runs on its own fork of the EntityManager, so it works outside an HTTP request
 * (queue jobs, the seed, tests) and never reads a stale row from a shared identity map.
 */
@Injectable()
export class MikroOrmRolesRepository implements RolesRepository {
  constructor(private readonly em: EntityManager) {}

  findAll(): Promise<Role[]> {
    return this.em.fork().find(RoleEntity, {}, { orderBy: { name: 'asc' } });
  }

  findById(id: string): Promise<Role | null> {
    return this.em.fork().findOne(RoleEntity, { id });
  }

  findByName(name: string): Promise<Role | null> {
    return this.em.fork().findOne(RoleEntity, { name });
  }

  async findByIds(ids: readonly string[]): Promise<Role[]> {
    if (ids.length === 0) return [];
    return this.em.fork().find(RoleEntity, { id: { $in: [...ids] } });
  }

  create(newRole: NewRole): Promise<Role> {
    return this.mapNameTaken(async () => {
      const now = new Date();
      const role: Role = { id: uuidv7(), ...newRole, createdAt: now, updatedAt: now };
      await this.em.fork().insert(RoleEntity, role);
      return role;
    });
  }

  update(id: string, { name, description, permissions }: RoleChanges): Promise<Role | null> {
    return this.mapNameTaken(async () => {
      const [role] = await this.em
        .fork()
        .createQueryBuilder(RoleEntity)
        .update({ ...definedFields({ name, description, permissions }), updatedAt: new Date() })
        .where({ id })
        .returning('*')
        .execute<Role[]>('all');
      return role ?? null;
    });
  }

  async delete(id: string): Promise<boolean> {
    // user_roles rows go with it (on delete cascade).
    const deleted = await this.em.fork().nativeDelete(RoleEntity, { id });
    return deleted === 1;
  }

  private async mapNameTaken<Result>(write: () => Promise<Result>): Promise<Result> {
    try {
      return await write();
    } catch (error) {
      const exception = toDriverException(this.em, error);
      if (isUniqueViolation(exception, ROLES_NAME_UNIQUE)) throw new RoleNameTakenException();
      throw exception;
    }
  }
}
