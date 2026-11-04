import { Command } from '@nestjs/cqrs';

/**
 * Signs the user out everywhere, then deletes them. `actorId` is the admin doing it, who can't
 * delete themselves (409). @throws UserNotFoundException
 */
export class DeleteUserCommand extends Command<void> {
  constructor(
    readonly id: string,
    readonly actorId: string,
  ) {
    super();
  }
}
