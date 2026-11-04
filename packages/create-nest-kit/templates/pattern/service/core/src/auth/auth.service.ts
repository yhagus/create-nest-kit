import type { User } from '../modules/users/user.js';
import type {
  Credentials,
  Device,
  IssuedTokens,
  PasswordChange,
  Registration,
  SignedIn,
} from './auth.types.js';

/**
 * The authentication flows behind `/auth`. Each auth style binds its own implementation in
 * `src/auth/auth-flows.ts`; `AuthController` only talks to this class. Emails arrive
 * normalized. Failures are the exceptions in `auth.exceptions.ts`.
 */
export abstract class AuthService {
  /** Creates a user with the `user` role and, when verification is on, mails a verification link. */
  abstract register(registration: Registration): Promise<User>;

  /** Starts a session. @throws InvalidCredentialsException, EmailNotVerifiedException */
  abstract login(credentials: Credentials, device: Device): Promise<SignedIn>;

  /** Rotates the refresh token; a reused one revokes its session. @throws InvalidRefreshTokenException */
  abstract refresh(refreshToken: string): Promise<IssuedTokens>;

  abstract logout(sessionId: string): Promise<void>;

  /**
   * Sets a new password, signs out every other session and mails a notice.
   * @throws InvalidCurrentPasswordException
   */
  abstract changePassword(user: User, sessionId: string, change: PasswordChange): Promise<void>;

  /** Mails a reset link if an account has this email; silently does nothing otherwise. */
  abstract forgotPassword(email: string): Promise<void>;

  /** Sets the password and signs out every session. @throws InvalidTokenException */
  abstract resetPassword(token: string, password: string): Promise<void>;

  /** @throws InvalidTokenException */
  abstract verifyEmail(token: string): Promise<void>;

  /** Mails a new verification link, invalidating older ones, if the email belongs to an unverified account. */
  abstract resendVerification(email: string): Promise<void>;
}
