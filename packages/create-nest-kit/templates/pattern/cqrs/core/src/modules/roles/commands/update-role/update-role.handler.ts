import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ALL_PERMISSIONS } from '../../../permissions/permission.js';
import { distinctPermissions } from '../../distinct-permissions.js';
import { isAdminRole, type Role } from '../../role.js';
import { RoleNotFoundException, RoleProtectedException } from '../../roles.exceptions.js';
import { RolesRepository } from '../../roles.repository.js';
import { UpdateRoleCommand } from './update-role.command.js';

@CommandHandler(UpdateRoleCommand)
export class UpdateRoleHandler implements ICommandHandler<UpdateRoleCommand> {
  constructor(private readonly roles: RolesRepository) {}

  async execute({ id, changes }: UpdateRoleCommand): Promise<Role> {
    const role = await this.roles.findById(id);
    if (!role) throw new RoleNotFoundException();
    if (role.isSystem && changes.name !== undefined && changes.name !== role.name) {
      throw new RoleProtectedException("System roles can't be renamed");
    }
    const permissions = changes.permissions && distinctPermissions(changes.permissions);
    if (isAdminRole(role) && permissions && permissions.length !== ALL_PERMISSIONS.length) {
      throw new RoleProtectedException('The admin role always has every permission');
    }
    const updated = await this.roles.update(id, { ...changes, permissions });
    if (!updated) throw new RoleNotFoundException();
    return updated;
  }
}
