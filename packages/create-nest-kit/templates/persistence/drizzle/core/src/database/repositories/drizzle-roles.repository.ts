import { Injectable } from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import type { Role } from '../../modules/roles/role.js';
import {
  type NewRole,
  type RoleChanges,
  RoleNameTakenException,
  RolesRepository,
} from '../../modules/roles/roles.repository.js';
import { type Database, InjectDatabase } from '../database.js';
import { firstRow, isUniqueViolation } from '../query-helpers.js';
import { ROLES_NAME_UNIQUE, roles } from '../schema/roles.js';

@Injectable()
export class DrizzleRolesRepository implements RolesRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  findAll(): Promise<Role[]> {
    return this.db.select().from(roles).orderBy(asc(roles.name));
  }

  async findById(id: string): Promise<Role | null> {
    const [role] = await this.db.select().from(roles).where(eq(roles.id, id));
    return role ?? null;
  }

  async findByName(name: string): Promise<Role | null> {
    const [role] = await this.db.select().from(roles).where(eq(roles.name, name));
    return role ?? null;
  }

  async findByIds(ids: readonly string[]): Promise<Role[]> {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(roles)
      .where(inArray(roles.id, [...ids]));
  }

  create(role: NewRole): Promise<Role> {
    return this.mapNameTaken(async () =>
      firstRow(await this.db.insert(roles).values(role).returning()),
    );
  }

  update(id: string, { name, description, permissions }: RoleChanges): Promise<Role | null> {
    return this.mapNameTaken(async () => {
      const [role] = await this.db
        .update(roles)
        .set({ name, description, permissions })
        .where(eq(roles.id, id))
        .returning();
      return role ?? null;
    });
  }

  async delete(id: string): Promise<boolean> {
    // user_roles rows go with it (on delete cascade).
    const deleted = await this.db.delete(roles).where(eq(roles.id, id)).returning({ id: roles.id });
    return deleted.length > 0;
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
