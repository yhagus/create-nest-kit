import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { RevokedSessionsEnforcer } from '../../revoked-sessions-enforcer.js';
import { SessionsRepository } from '../../sessions.repository.js';
import { RevokeSessionCommand } from './revoke-session.command.js';

@CommandHandler(RevokeSessionCommand)
export class RevokeSessionHandler implements ICommandHandler<RevokeSessionCommand> {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly revokedSessions: RevokedSessionsEnforcer,
  ) {}

  async execute({ sessionId }: RevokeSessionCommand): Promise<void> {
    if (await this.sessions.revoke(sessionId, new Date())) {
      await this.revokedSessions.enforce([sessionId]);
    }
  }
}
