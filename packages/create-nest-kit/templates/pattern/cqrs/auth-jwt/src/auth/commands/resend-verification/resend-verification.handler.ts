import { CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { FindUserByEmailQuery } from '../../../modules/users/queries/find-user-by-email/find-user-by-email.query.js';
import { VerificationMailSender } from '../../verification-mail-sender.js';
import { ResendVerificationCommand } from './resend-verification.command.js';

@CommandHandler(ResendVerificationCommand)
export class ResendVerificationHandler implements ICommandHandler<ResendVerificationCommand> {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly verificationMail: VerificationMailSender,
  ) {}

  async execute({ email }: ResendVerificationCommand): Promise<void> {
    const user = await this.queryBus.execute(new FindUserByEmailQuery(email));
    if (!user || user.emailVerifiedAt !== null) return;
    await this.verificationMail.send(user);
  }
}
