import { NotFoundException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { RevokedSessionsEnforcer } from '../../revoked-sessions-enforcer.js';
import { SessionsRepository } from '../../sessions.repository.js';
import { RevokeUserSessionCommand } from './revoke-user-session.command.js';

@CommandHandler(RevokeUserSessionCommand)
export class RevokeUserSessionHandler implements ICommandHandler<RevokeUserSessionCommand> {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly revokedSessions: RevokedSessionsEnforcer,
  ) {}

  async execute({ userId, sessionId }: RevokeUserSessionCommand): Promise<void> {
    if (!(await this.sessions.revoke(sessionId, new Date(), { userId }))) {
      throw new NotFoundException('Session not found');
    }
    await this.revokedSessions.enforce([sessionId]);
  }
}
