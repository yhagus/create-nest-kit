import { Query } from '@nestjs/cqrs';
import type { Role } from '../../role.js';

/** @throws RoleNotFoundException */
export class GetRoleByNameQuery extends Query<Role> {
  constructor(readonly name: string) {
    super();
  }
}
