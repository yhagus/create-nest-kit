import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { CreateSessionHandler } from './commands/create-session/create-session.handler.js';
import { RevokeAllUserSessionsHandler } from './commands/revoke-all-user-sessions/revoke-all-user-sessions.handler.js';
import { RevokeSessionHandler } from './commands/revoke-session/revoke-session.handler.js';
import { RevokeUserSessionHandler } from './commands/revoke-user-session/revoke-user-session.handler.js';
import { TouchSessionHandler } from './commands/touch-session/touch-session.handler.js';
import { ExpiredSessionsPurger } from './expired-sessions-purger.js';
import { IsSessionRevokedHandler } from './queries/is-session-revoked/is-session-revoked.handler.js';
import { ListActiveSessionsHandler } from './queries/list-active-sessions/list-active-sessions.handler.js';
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
  providers: [
    CreateSessionHandler,
    TouchSessionHandler,
    RevokeSessionHandler,
    RevokeUserSessionHandler,
    RevokeAllUserSessionsHandler,
    ListActiveSessionsHandler,
    IsSessionRevokedHandler,
    RevokedSessionsEnforcer,
    ExpiredSessionsPurger,
  ],
})
export class SessionsModule {}
