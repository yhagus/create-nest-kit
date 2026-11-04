import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppConfig } from '../../../../config/app-config.js';
import type { Session } from '../../session.js';
import { SessionsRepository } from '../../sessions.repository.js';
import { CreateSessionCommand } from './create-session.command.js';

@CommandHandler(CreateSessionCommand)
export class CreateSessionHandler implements ICommandHandler<CreateSessionCommand> {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly config: AppConfig,
  ) {}

  execute({ device }: CreateSessionCommand): Promise<Session> {
    const now = new Date();
    const absoluteExpiresAt = new Date(now.getTime() + this.config.get('SESSION_ABSOLUTE_TTL'));
    const slidingExpiresAt = new Date(now.getTime() + this.config.get('REFRESH_TOKEN_TTL'));
    return this.sessions.create({
      ...device,
      createdAt: now,
      expiresAt: slidingExpiresAt < absoluteExpiresAt ? slidingExpiresAt : absoluteExpiresAt,
      absoluteExpiresAt,
    });
  }
}
