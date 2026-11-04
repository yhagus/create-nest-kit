import { Command } from '@nestjs/cqrs';
import type { Role } from '../../role.js';

export interface SystemRoles {
  admin: Role;
  user: Role;
}

/** Creates the system roles if they are missing, and gives `admin` every permission. Run by the seed. */
export class SyncSystemRolesCommand extends Command<SystemRoles> {}
