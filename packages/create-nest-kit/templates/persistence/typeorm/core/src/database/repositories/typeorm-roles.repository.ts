import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import type { Role } from '../../modules/roles/role.js';
import {
  type NewRole,
  type RoleChanges,
  RoleNameTakenException,
  RolesRepository,
} from '../../modules/roles/roles.repository.js';
import { ROLES_NAME_UNIQUE, RoleEntity } from '../entities/role.entity.js';
import { isUniqueViolation, returnedEntities } from '../query-helpers.js';

@Injectable()
export class TypeOrmRolesRepository implements RolesRepository {
  constructor(@InjectRepository(RoleEntity) private readonly roles: Repository<RoleEntity>) {}

  findAll(): Promise<Role[]> {
    return this.roles.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<Role | null> {
    return this.roles.findOneBy({ id });
  }

  findByName(name: string): Promise<Role | null> {
    return this.roles.findOneBy({ name });
  }

  async findByIds(ids: readonly string[]): Promise<Role[]> {
    if (ids.length === 0) return [];
    return this.roles.findBy({ id: In([...ids]) });
  }

  create(newRole: NewRole): Promise<Role> {
    return this.mapNameTaken(async () => {
      const role = this.roles.create({ id: uuidv7(), ...newRole });
      // Fills in the columns the database defaults, like createdAt.
      await this.roles.insert(role);
      return role;
    });
  }

  update(id: string, { name, description, permissions }: RoleChanges): Promise<Role | null> {
    return this.mapNameTaken(async () => {
      const result = await this.roles
        .createQueryBuilder()
        .update()
        .set({ name, description, permissions })
        .where({ id })
        .returning('*')
        .execute();
      const [role] = returnedEntities(this.roles, result);
      return role ?? null;
    });
  }

  async delete(id: string): Promise<boolean> {
    // user_roles rows go with it (on delete cascade).
    const { affected } = await this.roles.delete({ id });
    return affected === 1;
  }

  private async mapNameTaken<Result>(write: () => Promise<Result>): Promise<Result> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueViolation(error, ROLES_NAME_UNIQUE)) throw new RoleNameTakenException();
      throw error;
    }
  }
}
