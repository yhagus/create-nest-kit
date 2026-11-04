import type { User } from '../modules/users/user.js';

// What the `/auth` flows take and return.

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
