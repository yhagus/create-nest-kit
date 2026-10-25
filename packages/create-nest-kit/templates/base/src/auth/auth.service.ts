import type { User } from '../modules/users/user.js';

export interface Credentials {
  email: string;
  password: string;
}

export interface Registration extends Credentials {
  name: string;
}

/** Where a sign-in comes from, shown in the user's session list. */
export interface Device {
  userAgent: string | null;
  ip: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Lifetime of the access token, in seconds. */
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface IssuedTokens {
  tokens: TokenPair;
  /** When the refresh token stops working; the refresh cookie expires with it. */
  refreshTokenExpiresAt: Date;
}

export interface SignedIn extends IssuedTokens {
  user: User;
}

export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
}

/**
 * The authentication flows behind `/auth`. Each auth style (`src/auth/auth.module.ts`) binds
 * its own implementation; `AuthController` only talks to this class. Emails arrive
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
