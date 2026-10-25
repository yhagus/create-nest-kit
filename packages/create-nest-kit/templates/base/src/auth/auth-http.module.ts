import { Module } from '@nestjs/common';
import { SessionsModule } from '../modules/sessions/sessions.module.js';
import { UsersModule } from '../modules/users/users.module.js';
import { AuthController } from './auth.controller.js';
import { RefreshCookie } from './refresh-cookie.js';

/**
 * The `/auth` routes, the same in every auth style. `AuthService` comes from the global
 * AuthModule, which binds the style's implementation.
 */
@Module({
  imports: [UsersModule, SessionsModule],
  controllers: [AuthController],
  providers: [RefreshCookie],
})
export class AuthHttpModule {}
