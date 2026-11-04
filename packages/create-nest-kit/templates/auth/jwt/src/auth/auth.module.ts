import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../config/app-config.js';
import { AuthPersistenceModule } from '../database/auth-persistence.module.js';
import { SessionDenyList } from '../modules/sessions/session-deny-list.js';
import { AccessTokens } from './access-tokens.js';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';
import { AUTH_FLOWS } from './auth-flows.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PasswordHasher } from './password-hasher.js';
import { PermissionsGuard } from './permissions.guard.js';
import { VerificationTokens } from './verification-tokens.js';

const MILLISECONDS_PER_SECOND = 1000;

/**
 * Hand-rolled authentication: HS256 access tokens, rotating refresh tokens and one-time
 * verification tokens, with argon2id passwords. Global, so other modules can use
 * `PasswordHasher`, `SessionDenyList` and what the `/auth` flows export without importing
 * this module back.
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
    ...AUTH_FLOWS.imports,
  ],
  providers: [
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    SessionDenyList,
    AccessTokens,
    VerificationTokens,
    // Guards run in this order, after the global ThrottlerGuard.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // In this module rather than one of their own, so the flows can use the providers above.
    ...AUTH_FLOWS.providers,
  ],
  exports: [PasswordHasher, SessionDenyList, ...AUTH_FLOWS.exports],
})
export class AuthModule {}
