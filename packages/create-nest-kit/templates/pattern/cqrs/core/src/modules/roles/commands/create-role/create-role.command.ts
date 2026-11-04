import { Command } from '@nestjs/cqrs';
import type { Permission } from '../../../permissions/permission.js';
import type { Role } from '../../role.js';

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissions: Permission[];
}

/** Creates a custom role, granting each permission once. */
export class CreateRoleCommand extends Command<Role> {
  constructor(readonly input: CreateRoleInput) {
    super();
  }
}
