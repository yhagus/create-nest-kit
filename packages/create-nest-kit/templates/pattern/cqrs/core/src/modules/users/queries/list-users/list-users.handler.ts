import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Page } from '../../../../common/pagination.js';
import type { User } from '../../user.js';
import { UsersRepository } from '../../users.repository.js';
import { ListUsersQuery } from './list-users.query.js';

@QueryHandler(ListUsersQuery)
export class ListUsersHandler implements IQueryHandler<ListUsersQuery> {
  constructor(private readonly users: UsersRepository) {}

  async execute({ query }: ListUsersQuery): Promise<Page<User>> {
    const { items, total } = await this.users.list(query);
    return { items, total, page: query.page, limit: query.limit };
  }
}
