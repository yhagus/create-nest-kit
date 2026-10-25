/** What a one-time token proves: that the user can read mail sent to their address. */
export const VerificationPurpose = {
  EmailVerification: 'email_verification',
  PasswordReset: 'password_reset',
} as const;

export type VerificationPurpose = (typeof VerificationPurpose)[keyof typeof VerificationPurpose];

export interface NewVerificationToken {
  userId: string;
  purpose: VerificationPurpose;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * One-time email-verification and password-reset tokens, stored as hashes. Bound by the
 * persistence layer in `src/database/auth-persistence.module.ts`;
 * `test/contracts/verification-tokens-repository.contract.ts` is its spec. Tokens go when
 * their user is deleted.
 */
export abstract class VerificationTokensRepository {
  /** Stores a token and, atomically, deletes the user's earlier tokens of the same purpose. */
  abstract replace(token: NewVerificationToken): Promise<void>;

  /**
   * Deletes the token with this hash and purpose if it is unexpired at `now`, and returns its
   * user id; null otherwise. Atomic, so a token can be used only once even by concurrent calls.
   */
  abstract consume(
    purpose: VerificationPurpose,
    tokenHash: string,
    now: Date,
  ): Promise<string | null>;

  /** Deletes the tokens that expired at or before `now`. Returns how many. */
  abstract deleteExpired(now: Date): Promise<number>;
}
