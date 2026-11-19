import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { CommandHandlers } from './commands/handlers/index.js';
import { ExpiredSessionsPurger } from './expired-sessions-purger.js';
import { QueryHandlers } from './queries/handlers/index.js';
import { RevokedSessionsEnforcer } from './revoked-sessions-enforcer.js';
import { UserSessionsController } from './user-sessions.controller.js';

/**
 * Device sessions. `SessionsRepository` comes from the global DatabaseModule and
 * `SessionDenyList` from the global AuthModule.
 */
@Module({
  // DiscoveryModule finds the @SessionRevocationHook() providers, whichever module declares them.
  imports: [DiscoveryModule],
  controllers: [UserSessionsController],
  providers: [...CommandHandlers, ...QueryHandlers, RevokedSessionsEnforcer, ExpiredSessionsPurger],
})
export class SessionsModule {}
