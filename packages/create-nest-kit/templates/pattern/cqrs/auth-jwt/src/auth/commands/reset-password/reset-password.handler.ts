import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { MarkEmailVerifiedCommand } from '../../../modules/users/commands/mark-email-verified/mark-email-verified.command.js';
import { UpdateUserCommand } from '../../../modules/users/commands/update-user/update-user.command.js';
import { InvalidTokenException } from '../../auth.exceptions.js';
import { VerificationTokens } from '../../verification-tokens.js';
import { VerificationPurpose } from '../../verification-tokens.repository.js';
import { ResetPasswordCommand } from './reset-password.command.js';

@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler implements ICommandHandler<ResetPasswordCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly verificationTokens: VerificationTokens,
  ) {}

  async execute({ token, password }: ResetPasswordCommand): Promise<void> {
    const userId = await this.verificationTokens.consume(VerificationPurpose.PasswordReset, token);
    if (userId === null) throw new InvalidTokenException();
    // A new password signs the user out of every session. The mailed link also proves the user
    // owns the address, so an unverified one becomes verified.
    await this.commandBus.execute(new UpdateUserCommand(userId, { password }));
    await this.commandBus.execute(new MarkEmailVerifiedCommand(userId));
  }
}
