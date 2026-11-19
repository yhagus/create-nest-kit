import { ChangePasswordHandler } from './change-password.handler.js';
import { ForgotPasswordHandler } from './forgot-password.handler.js';
import { LoginHandler } from './login.handler.js';
import { LogoutHandler } from './logout.handler.js';
import { RefreshTokensHandler } from './refresh-tokens.handler.js';
import { RegisterHandler } from './register.handler.js';
import { ResendVerificationHandler } from './resend-verification.handler.js';
import { ResetPasswordHandler } from './reset-password.handler.js';
import { VerifyEmailHandler } from './verify-email.handler.js';

export const CommandHandlers = [
  ChangePasswordHandler,
  ForgotPasswordHandler,
  LoginHandler,
  LogoutHandler,
  RefreshTokensHandler,
  RegisterHandler,
  ResendVerificationHandler,
  ResetPasswordHandler,
  VerifyEmailHandler,
];
