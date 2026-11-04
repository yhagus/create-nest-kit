import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Role } from '../../role.js';
import { RoleNotFoundException } from '../../roles.exceptions.js';
import { RolesRepository } from '../../roles.repository.js';
import { GetRoleByNameQuery } from './get-role-by-name.query.js';

@QueryHandler(GetRoleByNameQuery)
export class GetRoleByNameHandler implements IQueryHandler<GetRoleByNameQuery> {
  constructor(private readonly roles: RolesRepository) {}

  async execute({ name }: GetRoleByNameQuery): Promise<Role> {
    const role = await this.roles.findByName(name);
    if (!role) throw new RoleNotFoundException();
    return role;
  }
}
