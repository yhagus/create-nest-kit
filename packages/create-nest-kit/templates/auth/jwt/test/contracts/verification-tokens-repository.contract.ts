import { beforeEach, describe, expect, it } from 'vitest';
import {
  VerificationPurpose,
  type VerificationTokensRepository,
} from '../../src/auth/verification-tokens.repository.js';
import {
  type AuthRepositories,
  type AuthRepositoriesFactory,
  aVerificationToken,
} from './auth-repositories.js';
import { aUser, hoursFrom, NOW } from './repositories.js';

const { EmailVerification, PasswordReset } = VerificationPurpose;

/** The behaviour every `VerificationTokensRepository` implementation must have. */
export function describeVerificationTokensRepositoryContract(
  createRepositories: AuthRepositoriesFactory,
): void {
  describe('VerificationTokensRepository contract', () => {
    let repositories: AuthRepositories;
    let tokens: VerificationTokensRepository;
    let userId: string;
    let otherUserId: string;

    beforeEach(async () => {
      repositories = await createRepositories();
      tokens = repositories.verificationTokens;
      userId = (await repositories.users.create(aUser())).id;
      otherUserId = (await repositories.users.create(aUser({ email: 'grace@example.com' }))).id;
    });

    it('consumes a token once, returning its user', async () => {
      await tokens.replace(aVerificationToken(userId, { tokenHash: 'hash' }));

      expect(await tokens.consume(PasswordReset, 'hash', NOW)).toBe(userId);
      expect(await tokens.consume(PasswordReset, 'hash', NOW)).toBeNull();
    });

    it('does not consume a token for another purpose', async () => {
      await tokens.replace(
        aVerificationToken(userId, { purpose: EmailVerification, tokenHash: 'hash' }),
      );

      expect(await tokens.consume(PasswordReset, 'hash', NOW)).toBeNull();
      expect(await tokens.consume(EmailVerification, 'hash', NOW)).toBe(userId);
    });

    it('does not consume a token once it has expired', async () => {
      await tokens.replace(aVerificationToken(userId, { tokenHash: 'hash', expiresAt: NOW }));

      expect(await tokens.consume(PasswordReset, 'hash', NOW)).toBeNull();
    });

    it('lets only one of two concurrent consumptions of a token succeed', async () => {
      await tokens.replace(aVerificationToken(userId, { tokenHash: 'hash' }));

      const results = await Promise.all([
        tokens.consume(PasswordReset, 'hash', NOW),
        tokens.consume(PasswordReset, 'hash', NOW),
      ]);

      expect(results.filter((result) => result === userId)).toHaveLength(1);
    });

    it('replaces only the user’s earlier token of the same purpose', async () => {
      await tokens.replace(aVerificationToken(userId, { tokenHash: 'old-reset' }));
      await tokens.replace(
        aVerificationToken(userId, { purpose: EmailVerification, tokenHash: 'verify' }),
      );
      await tokens.replace(aVerificationToken(otherUserId, { tokenHash: 'other-users-reset' }));

      await tokens.replace(aVerificationToken(userId, { tokenHash: 'new-reset' }));

      expect(await tokens.consume(PasswordReset, 'old-reset', NOW)).toBeNull();
      expect(await tokens.consume(PasswordReset, 'new-reset', NOW)).toBe(userId);
      expect(await tokens.consume(EmailVerification, 'verify', NOW)).toBe(userId);
      expect(await tokens.consume(PasswordReset, 'other-users-reset', NOW)).toBe(otherUserId);
    });

    it('deletes the tokens that have expired', async () => {
      await tokens.replace(aVerificationToken(userId, { expiresAt: NOW, tokenHash: 'expired' }));
      await tokens.replace(
        aVerificationToken(otherUserId, { expiresAt: hoursFrom(NOW, 1), tokenHash: 'active' }),
      );

      expect(await tokens.deleteExpired(NOW)).toBe(1);

      expect(await tokens.consume(PasswordReset, 'active', NOW)).toBe(otherUserId);
    });

    it('deletes a user’s tokens with the user', async () => {
      await tokens.replace(aVerificationToken(userId, { tokenHash: 'hash' }));

      await repositories.users.delete(userId);

      expect(await tokens.consume(PasswordReset, 'hash', NOW)).toBeNull();
    });
  });
}
