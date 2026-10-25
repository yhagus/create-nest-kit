import { beforeEach, describe, expect, it } from 'vitest';
import type { RefreshTokensRepository } from '../../src/auth/refresh-tokens.repository.js';
import type { AuthRepositories, AuthRepositoriesFactory } from './auth-repositories.js';
import { aSession, aUser, hoursFrom, NOW, UNKNOWN_ID } from './repositories.js';

/** The behaviour every `RefreshTokensRepository` implementation must have. */
export function describeRefreshTokensRepositoryContract(
  createRepositories: AuthRepositoriesFactory,
): void {
  describe('RefreshTokensRepository contract', () => {
    let repositories: AuthRepositories;
    let refreshTokens: RefreshTokensRepository;
    let userId: string;
    let sessionId: string;

    beforeEach(async () => {
      repositories = await createRepositories();
      refreshTokens = repositories.refreshTokens;
      userId = (await repositories.users.create(aUser())).id;
      sessionId = (await repositories.sessions.create(aSession(userId))).id;
    });

    it('rotates the current token, again and again', async () => {
      await refreshTokens.create(sessionId, 'first');

      expect(await refreshTokens.rotate(sessionId, 'first', 'second')).toBe(true);
      expect(await refreshTokens.rotate(sessionId, 'second', 'third')).toBe(true);
    });

    it('refuses to rotate a token that was already rotated away, keeping the current one', async () => {
      await refreshTokens.create(sessionId, 'first');
      await refreshTokens.rotate(sessionId, 'first', 'second');

      expect(await refreshTokens.rotate(sessionId, 'first', 'stolen')).toBe(false);
      expect(await refreshTokens.rotate(sessionId, 'second', 'third')).toBe(true);
    });

    it('refuses to rotate for a session without a token', async () => {
      expect(await refreshTokens.rotate(UNKNOWN_ID, 'first', 'second')).toBe(false);
    });

    it('lets only one of two concurrent rotations of a token succeed', async () => {
      await refreshTokens.create(sessionId, 'first');

      const results = await Promise.all([
        refreshTokens.rotate(sessionId, 'first', 'second-a'),
        refreshTokens.rotate(sessionId, 'first', 'second-b'),
      ]);

      expect(results.toSorted()).toEqual([false, true]);
    });

    it('deletes a user’s tokens with the user', async () => {
      await refreshTokens.create(sessionId, 'first');

      await repositories.users.delete(userId);

      expect(await refreshTokens.rotate(sessionId, 'first', 'second')).toBe(false);
    });

    it('deletes the tokens of expired sessions with the sessions', async () => {
      const { sessions } = repositories;
      const expired = await sessions.create(aSession(userId, { expiresAt: hoursFrom(NOW, -1) }));
      await refreshTokens.create(expired.id, 'expired-first');
      await refreshTokens.create(sessionId, 'active-first');

      await sessions.deleteExpired(NOW);

      expect(await refreshTokens.rotate(expired.id, 'expired-first', 'next')).toBe(false);
      expect(await refreshTokens.rotate(sessionId, 'active-first', 'next')).toBe(true);
    });
  });
}
