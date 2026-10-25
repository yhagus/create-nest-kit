import { Global, Module } from '@nestjs/common';
import { AuthenticationModule, type Duration } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { AppConfig } from '../config/app-config.js';
import { AuthPersistenceModule } from '../database/auth-persistence.module.js';
import { webAppLink } from '../infra/mail/mailables/web-app-link.js';
import { RolesModule } from '../modules/roles/roles.module.js';
import { SessionsModule } from '../modules/sessions/sessions.module.js';
import { UsersModule } from '../modules/users/users.module.js';
import { AccessTokenProvider } from './access-token.provider.js';
import { AuthService } from './auth.service.js';
import { EmailVerificationMailer } from './email-verification-mailer.js';
import { NestAuthService } from './nest-auth.service.js';
import { PasswordHasher } from './password-hasher.js';
import { PasswordResetMailer } from './password-reset-mailer.js';
import { PermissionPolicy } from './permission.policy.js';
import { RefreshTokenRevocationHook } from './refresh-token-revocation.hook.js';
import { ScryptPasswordHasher } from './scrypt-password-hasher.js';

/** Our env durations are milliseconds; the package reads a bare number under a minute as a likely mistake. */
const milliseconds = (value: number): Duration => `${value}ms`;

/**
 * Authentication with `@nestjs/authentication` (JWT access tokens, rotating refresh tokens,
 * password reset and email verification links, scrypt passwords) and deny-by-default
 * authorization with `@nestjs/authorization`. Global, so domain modules can use
 * `PasswordHasher` and the auth routes `AuthService` without importing this module back.
 */
@Global()
@Module({
  imports: [
    // Before AuthorizationModule: its guard has to run after the authentication guard, which
    // AuthenticationModule registers globally and which needs a user on every non-public route.
    AuthenticationModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        accessToken: {
          key: config.get('JWT_SECRET'),
          ttl: milliseconds(config.get('ACCESS_TOKEN_TTL')),
        },
        refreshToken: {
          ttl: milliseconds(config.get('REFRESH_TOKEN_TTL')),
          absoluteTtl: milliseconds(config.get('SESSION_ABSOLUTE_TTL')),
        },
        passwordReset: {
          url: webAppLink(config, '/reset-password', {}),
          ttl: milliseconds(config.get('PASSWORD_RESET_TTL')),
        },
        emailVerification: {
          url: webAppLink(config, '/verify-email', {}),
          ttl: milliseconds(config.get('EMAIL_VERIFICATION_TTL')),
        },
      }),
    }),
    AuthorizationModule.forRoot(),
    AuthPersistenceModule,
    UsersModule,
    RolesModule,
    SessionsModule,
  ],
  providers: [
    { provide: PasswordHasher, useClass: ScryptPasswordHasher },
    { provide: AuthService, useClass: NestAuthService },
    AccessTokenProvider,
    PasswordResetMailer,
    EmailVerificationMailer,
    PermissionPolicy,
    RefreshTokenRevocationHook,
  ],
  exports: [PasswordHasher, AuthService],
})
export class AuthModule {}
