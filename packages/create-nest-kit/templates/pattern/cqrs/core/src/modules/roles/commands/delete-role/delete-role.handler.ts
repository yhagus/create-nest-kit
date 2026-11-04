import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { RoleNotFoundException, RoleProtectedException } from '../../roles.exceptions.js';
import { RolesRepository } from '../../roles.repository.js';
import { DeleteRoleCommand } from './delete-role.command.js';

@CommandHandler(DeleteRoleCommand)
export class DeleteRoleHandler implements ICommandHandler<DeleteRoleCommand> {
  constructor(private readonly roles: RolesRepository) {}

  async execute({ id }: DeleteRoleCommand): Promise<void> {
    const role = await this.roles.findById(id);
    if (!role) throw new RoleNotFoundException();
    if (role.isSystem) {
      throw new RoleProtectedException("System roles can't be deleted");
    }
    if (!(await this.roles.delete(id))) throw new RoleNotFoundException();
  }
}
