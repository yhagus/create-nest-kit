import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { SessionsService } from './sessions.service.js';
import { UserSessionsController } from './user-sessions.controller.js';

/**
 * Device sessions. `SessionsRepository` comes from the global DatabaseModule and
 * `SessionDenyList` from the global AuthModule.
 */
@Module({
  // DiscoveryModule finds the @SessionRevocationHook() providers, whichever module declares them.
  imports: [DiscoveryModule],
  controllers: [UserSessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
