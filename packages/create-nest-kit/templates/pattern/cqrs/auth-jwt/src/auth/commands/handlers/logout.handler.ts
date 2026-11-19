import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { RevokeSessionCommand } from '../../../modules/sessions/commands/impl/revoke-session.command.js';
import { LogoutCommand } from '../impl/logout.command.js';

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(private readonly commandBus: CommandBus) {}

  execute({ sessionId }: LogoutCommand): Promise<void> {
    return this.commandBus.execute(new RevokeSessionCommand(sessionId));
  }
}
