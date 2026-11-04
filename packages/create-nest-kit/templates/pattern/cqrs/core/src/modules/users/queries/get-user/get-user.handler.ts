import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { User } from '../../user.js';
import { UsersRepository } from '../../users.repository.js';
import { UserNotFoundException } from '../../users.exceptions.js';
import { GetUserQuery } from './get-user.query.js';

@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<GetUserQuery> {
  constructor(private readonly users: UsersRepository) {}

  async execute({ id }: GetUserQuery): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new UserNotFoundException();
    return user;
  }
}
