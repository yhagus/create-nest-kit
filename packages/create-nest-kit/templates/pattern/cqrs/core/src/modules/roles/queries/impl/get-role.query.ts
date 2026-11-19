import { Query } from '@nestjs/cqrs';
import type { Role } from '../../role.js';

/** @throws RoleNotFoundException */
export class GetRoleQuery extends Query<Role> {
  constructor(readonly id: string) {
    super();
  }
}
