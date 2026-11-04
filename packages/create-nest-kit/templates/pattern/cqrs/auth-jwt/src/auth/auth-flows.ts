import type { ModuleMetadata } from '@nestjs/common';
import { ChangePasswordHandler } from './commands/change-password/change-password.handler.js';
import { ForgotPasswordHandler } from './commands/forgot-password/forgot-password.handler.js';
import { LoginHandler } from './commands/login/login.handler.js';
import { LogoutHandler } from './commands/logout/logout.handler.js';
import { RefreshTokensHandler } from './commands/refresh-tokens/refresh-tokens.handler.js';
import { RegisterHandler } from './commands/register/register.handler.js';
import { ResendVerificationHandler } from './commands/resend-verification/resend-verification.handler.js';
import { ResetPasswordHandler } from './commands/reset-password/reset-password.handler.js';
import { VerifyEmailHandler } from './commands/verify-email/verify-email.handler.js';
import { SessionTokens } from './session-tokens.js';
import { VerificationMailSender } from './verification-mail-sender.js';

/**
 * The `/auth` flows, registered in AuthModule: the handlers of the `/auth` commands. They reach
 * users, roles and sessions through the buses, so nothing is imported or exported here.
 */
export const AUTH_FLOWS = {
  imports: [],
  providers: [
    RegisterHandler,
    LoginHandler,
    RefreshTokensHandler,
    LogoutHandler,
    ChangePasswordHandler,
    ForgotPasswordHandler,
    ResetPasswordHandler,
    VerifyEmailHandler,
    ResendVerificationHandler,
    SessionTokens,
    VerificationMailSender,
  ],
  exports: [],
} satisfies Required<Pick<ModuleMetadata, 'imports' | 'providers' | 'exports'>>;
