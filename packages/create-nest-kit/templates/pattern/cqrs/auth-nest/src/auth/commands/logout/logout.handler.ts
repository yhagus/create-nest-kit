import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { RevokeSessionCommand } from '../../../modules/sessions/commands/revoke-session/revoke-session.command.js';
import { LogoutCommand } from './logout.command.js';

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(private readonly commandBus: CommandBus) {}

  execute({ sessionId }: LogoutCommand): Promise<void> {
    return this.commandBus.execute(new RevokeSessionCommand(sessionId));
  }
}
