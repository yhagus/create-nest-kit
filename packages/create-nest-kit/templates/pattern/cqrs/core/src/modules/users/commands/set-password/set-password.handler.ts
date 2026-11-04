import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { PasswordHasher } from '../../../../auth/password-hasher.js';
import { RevokeAllUserSessionsCommand } from '../../../sessions/commands/revoke-all-user-sessions/revoke-all-user-sessions.command.js';
import { UsersRepository } from '../../users.repository.js';
import { UserNotFoundException } from '../../users.exceptions.js';
import { SetPasswordCommand } from './set-password.command.js';

@CommandHandler(SetPasswordCommand)
export class SetPasswordHandler implements ICommandHandler<SetPasswordCommand> {
  constructor(
    private readonly users: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly commandBus: CommandBus,
  ) {}

  async execute({ userId, newPassword, keepSessionId }: SetPasswordCommand): Promise<void> {
    const passwordHash = await this.passwordHasher.hash(newPassword);
    if (!(await this.users.update(userId, { passwordHash }))) throw new UserNotFoundException();
    await this.commandBus.execute(new RevokeAllUserSessionsCommand(userId, keepSessionId));
  }
}
