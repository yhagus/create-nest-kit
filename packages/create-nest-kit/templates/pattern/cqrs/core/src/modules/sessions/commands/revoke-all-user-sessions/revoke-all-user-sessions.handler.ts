import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { RevokedSessionsEnforcer } from '../../revoked-sessions-enforcer.js';
import { SessionsRepository } from '../../sessions.repository.js';
import { RevokeAllUserSessionsCommand } from './revoke-all-user-sessions.command.js';

@CommandHandler(RevokeAllUserSessionsCommand)
export class RevokeAllUserSessionsHandler implements ICommandHandler<RevokeAllUserSessionsCommand> {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly revokedSessions: RevokedSessionsEnforcer,
  ) {}

  async execute({ userId, exceptSessionId }: RevokeAllUserSessionsCommand): Promise<void> {
    const revokedIds = await this.sessions.revokeAllForUser(userId, new Date(), {
      exceptId: exceptSessionId,
    });
    await this.revokedSessions.enforce(revokedIds);
  }
}
