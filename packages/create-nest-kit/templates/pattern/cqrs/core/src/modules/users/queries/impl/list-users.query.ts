import { Query } from '@nestjs/cqrs';
import type { Page } from '../../../../common/pagination.js';
import type { User } from '../../user.js';
import type { UserListQuery } from '../../users.repository.js';

export class ListUsersQuery extends Query<Page<User>> {
  constructor(readonly query: UserListQuery) {
    super();
  }
}
