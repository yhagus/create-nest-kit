import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import type { Role as RoleRow } from '../../generated/prisma/client.js';
import type { Role } from '../../modules/roles/role.js';
import {
  type NewRole,
  type RoleChanges,
  RoleNameTakenException,
  RolesRepository,
} from '../../modules/roles/roles.repository.js';
import { toPermissions } from '../permissions.js';
import { PrismaService } from '../prisma.service.js';
import { isRecordNotFound, isUniqueViolation } from '../query-helpers.js';

/** Named in prisma/schema/roles.prisma. */
const ROLES_NAME_UNIQUE = 'roles_name_key';

@Injectable()
export class PrismaRolesRepository implements RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Role[]> {
    const rows = await this.prisma.role.findMany({ orderBy: { name: 'asc' } });
    return rows.map(toRole);
  }

  async findById(id: string): Promise<Role | null> {
    const row = await this.prisma.role.findUnique({ where: { id } });
    return row && toRole(row);
  }

  async findByName(name: string): Promise<Role | null> {
    const row = await this.prisma.role.findUnique({ where: { name } });
    return row && toRole(row);
  }

  async findByIds(ids: readonly string[]): Promise<Role[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.role.findMany({ where: { id: { in: [...ids] } } });
    return rows.map(toRole);
  }

  create(role: NewRole): Promise<Role> {
    return this.mapNameTaken(async () =>
      toRole(await this.prisma.role.create({ data: { id: uuidv7(), ...role } })),
    );
  }

  update(id: string, { name, description, permissions }: RoleChanges): Promise<Role | null> {
    return this.mapNameTaken(async () => {
      try {
        const row = await this.prisma.role.update({
          where: { id },
          data: { name, description, permissions },
        });
        return toRole(row);
      } catch (error) {
        if (isRecordNotFound(error)) return null;
        throw error;
      }
    });
  }

  async delete(id: string): Promise<boolean> {
    // user_roles rows go with it (on delete cascade).
    const { count } = await this.prisma.role.deleteMany({ where: { id } });
    return count > 0;
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

function toRole(row: RoleRow): Role {
  return { ...row, permissions: toPermissions(row.permissions) };
}
