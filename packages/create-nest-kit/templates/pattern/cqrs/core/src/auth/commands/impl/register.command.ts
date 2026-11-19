import { Command } from '@nestjs/cqrs';
import type { User } from '../../../modules/users/user.js';
import type { Registration } from '../../auth.types.js';

/** Creates a user with the `user` role and, when verification is on, mails a verification link. */
export class RegisterCommand extends Command<User> {
  constructor(readonly registration: Registration) {
    super();
  }
}
