import { EmailVerificationService } from '@nestjs/authentication';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { InvalidTokenException } from '../../auth.exceptions.js';
import { VerifyEmailCommand } from './verify-email.command.js';

/** `EmailVerificationService` marks the address verified, through EmailVerificationMailer. */
@CommandHandler(VerifyEmailCommand)
export class VerifyEmailHandler implements ICommandHandler<VerifyEmailCommand> {
  constructor(private readonly emailVerification: EmailVerificationService) {}

  async execute({ token }: VerifyEmailCommand): Promise<void> {
    if (!(await this.emailVerification.verify(token))) throw new InvalidTokenException();
  }
}
