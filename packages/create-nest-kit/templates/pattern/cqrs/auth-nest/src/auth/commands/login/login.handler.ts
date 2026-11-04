import { TokenService } from '@nestjs/authentication';
import { CommandBus, CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { AppConfig } from '../../../config/app-config.js';
import { CreateSessionCommand } from '../../../modules/sessions/commands/create-session/create-session.command.js';
import { FindUserByEmailQuery } from '../../../modules/users/queries/find-user-by-email/find-user-by-email.query.js';
import { EmailNotVerifiedException, InvalidCredentialsException } from '../../auth.exceptions.js';
import type { SignedIn } from '../../auth.types.js';
import { toIssuedTokens } from '../../issued-tokens.js';
import { PasswordHasher } from '../../password-hasher.js';
import { LoginCommand } from './login.command.js';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly config: AppConfig,
  ) {}

  async execute({ credentials: { email, password }, device }: LoginCommand): Promise<SignedIn> {
    const user = await this.queryBus.execute(new FindUserByEmailQuery(email));
    // Checked against a dummy hash for an unknown email too, so timing doesn't reveal accounts.
    const isPasswordCorrect = await this.passwordHasher.verify(
      password,
      user?.passwordHash ?? null,
    );
    if (!user || !isPasswordCorrect) throw new InvalidCredentialsException();
    if (this.config.get('EMAIL_VERIFICATION_ENABLED') && user.emailVerifiedAt === null) {
      throw new EmailNotVerifiedException();
    }
    const session = await this.commandBus.execute(
      new CreateSessionCommand({ userId: user.id, ...device }),
    );
    // Every access token of this sign-in, refreshed ones included, carries the session as `sid`.
    const pair = await this.tokens.issue(user.id, {
      method: 'password',
      claims: { sid: session.id },
    });
    return { user, ...toIssuedTokens(pair, session) };
  }
}
