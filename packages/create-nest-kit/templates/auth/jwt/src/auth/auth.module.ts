import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../config/app-config.js';
import { AuthPersistenceModule } from '../database/auth-persistence.module.js';
import { RolesModule } from '../modules/roles/roles.module.js';
import { SessionsModule } from '../modules/sessions/sessions.module.js';
import { UsersModule } from '../modules/users/users.module.js';
import { AccessTokens } from './access-tokens.js';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtAuthService } from './jwt-auth.service.js';
import { PasswordHasher } from './password-hasher.js';
import { PermissionsGuard } from './permissions.guard.js';
import { SessionTokens } from './session-tokens.js';
import { VerificationTokens } from './verification-tokens.js';

const MILLISECONDS_PER_SECOND = 1000;

/**
 * Hand-rolled authentication: HS256 access tokens, rotating refresh tokens and one-time
 * verification tokens, with argon2id passwords. Global, so domain modules can use
 * `PasswordHasher` and the auth routes `AuthService` without importing this module back.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: Math.floor(config.get('ACCESS_TOKEN_TTL') / MILLISECONDS_PER_SECOND),
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    AuthPersistenceModule,
    UsersModule,
    RolesModule,
    SessionsModule,
  ],
  providers: [
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: AuthService, useClass: JwtAuthService },
    AccessTokens,
    SessionTokens,
    VerificationTokens,
    // Guards run in this order, after the global ThrottlerGuard.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [PasswordHasher, AuthService],
})
export class AuthModule {}
