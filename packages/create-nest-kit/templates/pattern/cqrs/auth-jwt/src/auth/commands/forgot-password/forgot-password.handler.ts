import { CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { MailQueue } from '../../../infra/mail/mail.queue.js';
import { FindUserByEmailQuery } from '../../../modules/users/queries/find-user-by-email/find-user-by-email.query.js';
import { VerificationTokens } from '../../verification-tokens.js';
import { VerificationPurpose } from '../../verification-tokens.repository.js';
import { ForgotPasswordCommand } from './forgot-password.command.js';

@CommandHandler(ForgotPasswordCommand)
export class ForgotPasswordHandler implements ICommandHandler<ForgotPasswordCommand> {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly verificationTokens: VerificationTokens,
    private readonly mailQueue: MailQueue,
  ) {}

  async execute({ email }: ForgotPasswordCommand): Promise<void> {
    const user = await this.queryBus.execute(new FindUserByEmailQuery(email));
    if (!user) return;
    const token = await this.verificationTokens.issue(user.id, VerificationPurpose.PasswordReset);
    await this.mailQueue.enqueue({
      mail: 'reset-password',
      to: user.email,
      data: { name: user.name, token },
    });
  }
}
