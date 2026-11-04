import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { distinctPermissions } from '../../distinct-permissions.js';
import type { Role } from '../../role.js';
import { RolesRepository } from '../../roles.repository.js';
import { CreateRoleCommand } from './create-role.command.js';

@CommandHandler(CreateRoleCommand)
export class CreateRoleHandler implements ICommandHandler<CreateRoleCommand> {
  constructor(private readonly roles: RolesRepository) {}

  execute({ input: { name, description = '', permissions } }: CreateRoleCommand): Promise<Role> {
    return this.roles.create({
      name,
      description,
      permissions: distinctPermissions(permissions),
      isSystem: false,
    });
  }
}
