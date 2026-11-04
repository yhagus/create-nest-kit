import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { normalizeEmail } from '../../email.js';
import type { User } from '../../user.js';
import { UsersRepository } from '../../users.repository.js';
import { FindUserByEmailQuery } from './find-user-by-email.query.js';

@QueryHandler(FindUserByEmailQuery)
export class FindUserByEmailHandler implements IQueryHandler<FindUserByEmailQuery> {
  constructor(private readonly users: UsersRepository) {}

  execute({ email }: FindUserByEmailQuery): Promise<User | null> {
    return this.users.findByEmail(normalizeEmail(email));
  }
}
