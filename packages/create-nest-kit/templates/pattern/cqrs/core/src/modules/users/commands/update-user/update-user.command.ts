import { Command } from '@nestjs/cqrs';
import type { User } from '../../user.js';
import type { CreateUserInput } from '../create-user/create-user.command.js';

export type UpdateUserInput = Partial<CreateUserInput>;

/**
 * Changes the given fields. A new password signs the user out of every session.
 * @throws UserNotFoundException, UserEmailTakenException, UnknownRoleIdsException
 */
export class UpdateUserCommand extends Command<User> {
  constructor(
    readonly id: string,
    readonly input: UpdateUserInput,
  ) {
    super();
  }
}
