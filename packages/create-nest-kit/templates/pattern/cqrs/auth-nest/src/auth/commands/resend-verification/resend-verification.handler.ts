import { AuthenticationStorage, EmailVerificationService } from '@nestjs/authentication';
import { CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { FindUserByEmailQuery } from '../../../modules/users/queries/find-user-by-email/find-user-by-email.query.js';
import { ResendVerificationCommand } from './resend-verification.command.js';

@CommandHandler(ResendVerificationCommand)
export class ResendVerificationHandler implements ICommandHandler<ResendVerificationCommand> {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly emailVerification: EmailVerificationService,
    private readonly storage: AuthenticationStorage,
  ) {}

  async execute({ email }: ResendVerificationCommand): Promise<void> {
    const user = await this.queryBus.execute(new FindUserByEmailQuery(email));
    if (!user || user.emailVerifiedAt !== null) return;
    // The package keeps older links working; the contract has a new one replace them.
    await this.storage.emailTokens.deleteUserEmailTokens(user.id, 'email-verification');
    await this.emailVerification.send({ id: user.id, email: user.email });
  }
}
