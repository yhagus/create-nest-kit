import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppConfig } from '../../../../config/app-config.js';
import type { Session } from '../../session.js';
import { SessionsRepository } from '../../sessions.repository.js';
import { TouchSessionCommand } from './touch-session.command.js';

@CommandHandler(TouchSessionCommand)
export class TouchSessionHandler implements ICommandHandler<TouchSessionCommand> {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly config: AppConfig,
  ) {}

  execute({ sessionId }: TouchSessionCommand): Promise<Session | null> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.get('REFRESH_TOKEN_TTL'));
    return this.sessions.touch(sessionId, now, expiresAt);
  }
}
