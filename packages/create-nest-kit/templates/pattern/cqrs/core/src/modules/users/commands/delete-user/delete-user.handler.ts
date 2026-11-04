import { ConflictException } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ErrorCode } from '../../../../common/error-code.js';
import { RevokeAllUserSessionsCommand } from '../../../sessions/commands/revoke-all-user-sessions/revoke-all-user-sessions.command.js';
import { UsersRepository } from '../../users.repository.js';
import { UserNotFoundException } from '../../users.exceptions.js';
import { DeleteUserCommand } from './delete-user.command.js';

@CommandHandler(DeleteUserCommand)
export class DeleteUserHandler implements ICommandHandler<DeleteUserCommand> {
  constructor(
    private readonly users: UsersRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async execute({ id, actorId }: DeleteUserCommand): Promise<void> {
    if (id === actorId) {
      throw new ConflictException("You can't delete your own account", {
        errorCode: ErrorCode.UserCannotDeleteSelf,
      });
    }
    // Revoked first: the sessions rows go with the user, and the deny-list needs their ids.
    await this.commandBus.execute(new RevokeAllUserSessionsCommand(id));
    if (!(await this.users.delete(id))) throw new UserNotFoundException();
  }
}
