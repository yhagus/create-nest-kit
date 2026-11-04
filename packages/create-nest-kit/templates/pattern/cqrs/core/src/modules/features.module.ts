import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthHttpModule } from '../auth/auth-http.module.js';
import { PermissionsModule } from './permissions/permissions.module.js';
import { RolesModule } from './roles/roles.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { UsersModule } from './users/users.module.js';

/**
 * The API's routes and the command and query handlers behind them: `/auth`, users, roles,
 * permissions and sessions. `CqrsModule.forRoot()` is global: every module can inject the buses,
 * and handlers are found in every module, including the `/auth` ones in AuthModule.
 */
@Module({
  imports: [
    CqrsModule.forRoot(),
    AuthHttpModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    SessionsModule,
  ],
})
export class FeaturesModule {}
