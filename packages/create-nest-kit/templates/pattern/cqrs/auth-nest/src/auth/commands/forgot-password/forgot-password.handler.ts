import { AuthenticationStorage, PasswordResetService } from '@nestjs/authentication';
import { CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { FindUserByEmailQuery } from '../../../modules/users/queries/find-user-by-email/find-user-by-email.query.js';
import { ForgotPasswordCommand } from './forgot-password.command.js';

@CommandHandler(ForgotPasswordCommand)
export class ForgotPasswordHandler implements ICommandHandler<ForgotPasswordCommand> {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly passwordReset: PasswordResetService,
    private readonly storage: AuthenticationStorage,
  ) {}

  async execute({ email }: ForgotPasswordCommand): Promise<void> {
    const user = await this.queryBus.execute(new FindUserByEmailQuery(email));
    if (!user) return;
    // The package keeps older links working; the contract has a new one replace them.
    await this.storage.emailTokens.deleteUserEmailTokens(user.id, 'password-reset');
    // Mails the link in the background, through PasswordResetMailer.
    this.passwordReset.request(user.email);
  }
}
