import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Role } from '../../role.js';
import { RolesRepository } from '../../roles.repository.js';
import { ListRolesQuery } from './list-roles.query.js';

@QueryHandler(ListRolesQuery)
export class ListRolesHandler implements IQueryHandler<ListRolesQuery> {
  constructor(private readonly roles: RolesRepository) {}

  execute(): Promise<Role[]> {
    return this.roles.findAll();
  }
}
