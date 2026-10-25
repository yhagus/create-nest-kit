import { randomUUID } from 'node:crypto';
import type { Role } from '../../src/modules/roles/role.js';
import {
  type NewRole,
  type RoleChanges,
  RoleNameTakenException,
  type RolesRepository,
} from '../../src/modules/roles/roles.repository.js';
import type { InMemoryStore } from './in-memory-store.js';

export class InMemoryRolesRepository implements RolesRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findAll(): Promise<Role[]> {
    return [...this.store.roles.values()]
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .map((role) => structuredClone(role));
  }

  async findById(id: string): Promise<Role | null> {
    const role = this.store.roles.get(id);
    return role ? structuredClone(role) : null;
  }

  async findByName(name: string): Promise<Role | null> {
    const role = [...this.store.roles.values()].find((candidate) => candidate.name === name);
    return role ? structuredClone(role) : null;
  }

  async findByIds(ids: readonly string[]): Promise<Role[]> {
    return [...this.store.roles.values()]
      .filter((role) => ids.includes(role.id))
      .map((role) => structuredClone(role));
  }

  async create(newRole: NewRole): Promise<Role> {
    this.assertNameIsFree(newRole.name);
    const now = new Date();
    const role: Role = {
      ...structuredClone(newRole),
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.store.roles.set(role.id, role);
    return structuredClone(role);
  }

  async update(id: string, changes: RoleChanges): Promise<Role | null> {
    const existing = this.store.roles.get(id);
    if (!existing) return null;
    if (changes.name !== undefined && changes.name !== existing.name) {
      this.assertNameIsFree(changes.name);
    }
    const role: Role = {
      ...existing,
      name: changes.name ?? existing.name,
      description: changes.description ?? existing.description,
      permissions: changes.permissions ? [...changes.permissions] : existing.permissions,
      updatedAt: new Date(),
    };
    this.store.roles.set(id, role);
    return structuredClone(role);
  }

  async delete(id: string): Promise<boolean> {
    if (!this.store.roles.delete(id)) return false;
    for (const user of this.store.users.values()) {
      user.roleIds = user.roleIds.filter((roleId) => roleId !== id);
    }
    return true;
  }

  private assertNameIsFree(name: string): void {
    if ([...this.store.roles.values()].some((role) => role.name === name)) {
      throw new RoleNameTakenException();
    }
  }
}
