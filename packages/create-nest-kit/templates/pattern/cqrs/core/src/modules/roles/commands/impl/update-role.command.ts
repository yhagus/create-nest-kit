import { Command } from '@nestjs/cqrs';
import type { Role } from '../../role.js';
import type { RoleChanges } from '../../roles.repository.js';

/**
 * System roles can't be renamed; the admin role keeps every permission.
 * @throws RoleNotFoundException, RoleProtectedException
 */
export class UpdateRoleCommand extends Command<Role> {
  constructor(
    readonly id: string,
    readonly changes: RoleChanges,
  ) {
    super();
  }
}
