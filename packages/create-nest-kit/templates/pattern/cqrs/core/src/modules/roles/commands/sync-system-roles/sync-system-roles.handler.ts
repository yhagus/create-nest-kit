import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ALL_PERMISSIONS } from '../../../permissions/permission.js';
import { type Role, SystemRoleName } from '../../role.js';
import { RoleNotFoundException } from '../../roles.exceptions.js';
import { type NewRole, RolesRepository } from '../../roles.repository.js';
import { type SystemRoles, SyncSystemRolesCommand } from './sync-system-roles.command.js';

@CommandHandler(SyncSystemRolesCommand)
export class SyncSystemRolesHandler implements ICommandHandler<SyncSystemRolesCommand> {
  constructor(private readonly roles: RolesRepository) {}

  async execute(): Promise<SystemRoles> {
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
    const syncedAdmin = await this.roles.update(admin.id, { permissions: [...ALL_PERMISSIONS] });
    if (!syncedAdmin) throw new RoleNotFoundException();
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
}
