import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Role } from '../../role.js';
import { RoleNotFoundException } from '../../roles.exceptions.js';
import { RolesRepository } from '../../roles.repository.js';
import { GetRoleQuery } from './get-role.query.js';

@QueryHandler(GetRoleQuery)
export class GetRoleHandler implements IQueryHandler<GetRoleQuery> {
  constructor(private readonly roles: RolesRepository) {}

  async execute({ id }: GetRoleQuery): Promise<Role> {
    const role = await this.roles.findById(id);
    if (!role) throw new RoleNotFoundException();
    return role;
  }
}
