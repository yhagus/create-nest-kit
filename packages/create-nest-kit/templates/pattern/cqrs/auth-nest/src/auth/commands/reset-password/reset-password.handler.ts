import { PasswordResetService } from '@nestjs/authentication';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { RevokeAllUserSessionsCommand } from '../../../modules/sessions/commands/revoke-all-user-sessions/revoke-all-user-sessions.command.js';
import { InvalidTokenException } from '../../auth.exceptions.js';
import { ResetPasswordCommand } from './reset-password.command.js';

@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler implements ICommandHandler<ResetPasswordCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly passwordReset: PasswordResetService,
  ) {}

  async execute({ token, password }: ResetPasswordCommand): Promise<void> {
    const reset = await this.passwordReset.reset(token, password);
    if (!reset) throw new InvalidTokenException();
    // The package ended its own sign-ins of the user; this ends the device sessions and,
    // through the deny-list, their access tokens.
    await this.commandBus.execute(new RevokeAllUserSessionsCommand(reset.userId));
  }
}
