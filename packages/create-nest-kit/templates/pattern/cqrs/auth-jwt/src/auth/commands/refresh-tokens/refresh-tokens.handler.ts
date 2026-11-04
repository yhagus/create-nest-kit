import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { IssuedTokens } from '../../auth.types.js';
import { SessionTokens } from '../../session-tokens.js';
import { RefreshTokensCommand } from './refresh-tokens.command.js';

@CommandHandler(RefreshTokensCommand)
export class RefreshTokensHandler implements ICommandHandler<RefreshTokensCommand> {
  constructor(private readonly sessionTokens: SessionTokens) {}

  execute({ refreshToken }: RefreshTokensCommand): Promise<IssuedTokens> {
    return this.sessionTokens.refresh(refreshToken);
  }
}
