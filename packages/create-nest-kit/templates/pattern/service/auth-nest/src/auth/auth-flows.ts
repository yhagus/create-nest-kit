import type { ModuleMetadata } from '@nestjs/common';
import { RolesModule } from '../modules/roles/roles.module.js';
import { SessionsModule } from '../modules/sessions/sessions.module.js';
import { UsersModule } from '../modules/users/users.module.js';
import { AuthService } from './auth.service.js';
import { NestAuthService } from './nest-auth.service.js';

/** The `/auth` flows, registered in AuthModule: `AuthService`, built on the module services. */
export const AUTH_FLOWS = {
  imports: [UsersModule, RolesModule, SessionsModule],
  providers: [{ provide: AuthService, useClass: NestAuthService }],
  exports: [AuthService],
} satisfies Required<Pick<ModuleMetadata, 'imports' | 'providers' | 'exports'>>;
