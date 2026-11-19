import { Query } from '@nestjs/cqrs';
import type { User } from '../../user.js';

/** The user with this email, in any case or surrounding whitespace; null when there is none. */
export class FindUserByEmailQuery extends Query<User | null> {
  constructor(readonly email: string) {
    super();
  }
}
