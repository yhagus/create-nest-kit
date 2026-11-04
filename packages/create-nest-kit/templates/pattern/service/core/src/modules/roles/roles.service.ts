import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../../common/error-code.js';
import { ALL_PERMISSIONS, type Permission } from '../permissions/permission.js';
import { isAdminRole, type Role, SystemRoleName } from './role.js';
import { type NewRole, type RoleChanges, RolesRepository } from './roles.repository.js';

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissions: Permission[];
}

export interface SystemRoles {
  admin: Role;
  user: Role;
}

@Injectable()
export class RolesService {
  constructor(private readonly roles: RolesRepository) {}

  listRoles(): Promise<Role[]> {
    return this.roles.findAll();
  }

  async getRole(id: string): Promise<Role> {
    const role = await this.roles.findById(id);
    if (!role) throw roleNotFound();
    return role;
  }

  async getRoleByName(name: string): Promise<Role> {
    const role = await this.roles.findByName(name);
    if (!role) throw roleNotFound();
    return role;
  }

  createRole({ name, description = '', permissions }: CreateRoleInput): Promise<Role> {
    return this.roles.create({
      name,
      description,
      permissions: distinct(permissions),
      isSystem: false,
    });
  }

  async updateRole(id: string, changes: RoleChanges): Promise<Role> {
    const role = await this.getRole(id);
    if (role.isSystem && changes.name !== undefined && changes.name !== role.name) {
      throw roleProtected("System roles can't be renamed");
    }
    const permissions = changes.permissions && distinct(changes.permissions);
    if (isAdminRole(role) && permissions && permissions.length !== ALL_PERMISSIONS.length) {
      throw roleProtected('The admin role always has every permission');
    }
    return this.updateExisting(id, { ...changes, permissions });
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.getRole(id);
    if (role.isSystem) {
      throw roleProtected("System roles can't be deleted");
    }
    if (!(await this.roles.delete(id))) throw roleNotFound();
  }

  /** Creates the system roles if they are missing, and gives `admin` every permission. Run by the seed. */
  async syncSystemRoles(): Promise<SystemRoles> {
    const admin = await this.ensureSystemRole({
      name: SystemRoleName.Admin,
      description: 'Full access',
      permissions: [...ALL_PERMISSIONS],
      isSystem: true,
    });
    const user = await this.ensureSystemRole({
      name: SystemRoleName.User,
      description: 'Every self-registered user',
      permissions: [],
      isSystem: true,
    });
    // Permissions added to the enum since the last run go to admin as well.
    const syncedAdmin = await this.updateExisting(admin.id, { permissions: [...ALL_PERMISSIONS] });
    return { admin: syncedAdmin, user };
  }

  private async ensureSystemRole(systemRole: NewRole): Promise<Role> {
    const existing = await this.roles.findByName(systemRole.name);
    if (!existing) return this.roles.create(systemRole);
    if (!existing.isSystem) {
      throw new Error(
        `A custom role named "${systemRole.name}" exists; rename it, then seed again`,
      );
    }
    return existing;
  }

  private async updateExisting(id: string, changes: RoleChanges): Promise<Role> {
    const role = await this.roles.update(id, changes);
    if (!role) throw roleNotFound();
    return role;
  }
}

/** Each permission once, in declaration order. */
function distinct(permissions: readonly Permission[]): Permission[] {
  return ALL_PERMISSIONS.filter((permission) => permissions.includes(permission));
}

function roleNotFound(): NotFoundException {
  return new NotFoundException('Role not found');
}

function roleProtected(message: string): ConflictException {
  return new ConflictException(message, { errorCode: ErrorCode.RoleProtected });
}
