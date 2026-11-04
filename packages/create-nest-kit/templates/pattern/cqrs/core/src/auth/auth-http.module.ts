import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { RefreshCookie } from './refresh-cookie.js';

/**
 * The `/auth` routes, the same in every auth style. The handlers of their commands are
 * registered in the global AuthModule, by the style's `auth-flows.ts`.
 */
@Module({
  controllers: [AuthController],
  providers: [RefreshCookie],
})
export class AuthHttpModule {}
