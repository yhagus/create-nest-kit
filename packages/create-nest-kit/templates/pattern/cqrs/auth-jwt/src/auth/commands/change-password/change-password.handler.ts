import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { MailQueue } from '../../../infra/mail/mail.queue.js';
import { SetPasswordCommand } from '../../../modules/users/commands/set-password/set-password.command.js';
import { InvalidCurrentPasswordException } from '../../auth.exceptions.js';
import { PasswordHasher } from '../../password-hasher.js';
import { ChangePasswordCommand } from './change-password.command.js';

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly passwordHasher: PasswordHasher,
    private readonly mailQueue: MailQueue,
  ) {}

  async execute({
    user,
    sessionId,
    change: { currentPassword, newPassword },
  }: ChangePasswordCommand): Promise<void> {
    if (!(await this.passwordHasher.verify(currentPassword, user.passwordHash))) {
      throw new InvalidCurrentPasswordException();
    }
    await this.commandBus.execute(new SetPasswordCommand(user.id, newPassword, sessionId));
    await this.mailQueue.enqueue({
      mail: 'password-changed',
      to: user.email,
      data: { name: user.name },
    });
  }
}
