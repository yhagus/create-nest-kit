import { Command } from '@nestjs/cqrs';

/**
 * Also takes the role away from every user. System roles can't be deleted.
 * @throws RoleNotFoundException, RoleProtectedException
 */
export class DeleteRoleCommand extends Command<void> {
  constructor(readonly id: string) {
    super();
  }
}
