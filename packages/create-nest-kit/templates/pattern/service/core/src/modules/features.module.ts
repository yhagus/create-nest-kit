import { Module } from '@nestjs/common';
import { AuthHttpModule } from '../auth/auth-http.module.js';
import { PermissionsModule } from './permissions/permissions.module.js';
import { RolesModule } from './roles/roles.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { UsersModule } from './users/users.module.js';

/** The API's routes and the logic behind them: `/auth`, users, roles, permissions and sessions. */
@Module({
  imports: [AuthHttpModule, UsersModule, RolesModule, PermissionsModule, SessionsModule],
})
export class FeaturesModule {}
