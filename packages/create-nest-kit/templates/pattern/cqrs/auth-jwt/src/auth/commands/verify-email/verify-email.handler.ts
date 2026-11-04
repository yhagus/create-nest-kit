import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { MarkEmailVerifiedCommand } from '../../../modules/users/commands/mark-email-verified/mark-email-verified.command.js';
import { InvalidTokenException } from '../../auth.exceptions.js';
import { VerificationTokens } from '../../verification-tokens.js';
import { VerificationPurpose } from '../../verification-tokens.repository.js';
import { VerifyEmailCommand } from './verify-email.command.js';

@CommandHandler(VerifyEmailCommand)
export class VerifyEmailHandler implements ICommandHandler<VerifyEmailCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly verificationTokens: VerificationTokens,
  ) {}

  async execute({ token }: VerifyEmailCommand): Promise<void> {
    const userId = await this.verificationTokens.consume(
      VerificationPurpose.EmailVerification,
      token,
    );
    if (userId === null) throw new InvalidTokenException();
    await this.commandBus.execute(new MarkEmailVerifiedCommand(userId));
  }
}
