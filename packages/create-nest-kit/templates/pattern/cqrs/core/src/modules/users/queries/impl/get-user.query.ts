import { Query } from '@nestjs/cqrs';
import type { User } from '../../user.js';

/** @throws UserNotFoundException */
export class GetUserQuery extends Query<User> {
  constructor(readonly id: string) {
    super();
  }
}
