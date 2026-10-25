import { beforeEach, describe, expect, it } from 'vitest';
import type { SessionsRepository } from '../../src/modules/sessions/sessions.repository.js';
import type { UsersRepository } from '../../src/modules/users/users.repository.js';
import {
  aSession,
  aUser,
  hoursFrom,
  NOW,
  type RepositoriesFactory,
  UNKNOWN_ID,
} from './repositories.js';

/** The behaviour every `SessionsRepository` implementation must have. */
export function describeSessionsRepositoryContract(createRepositories: RepositoriesFactory): void {
  describe('SessionsRepository contract', () => {
    let sessions: SessionsRepository;
    let users: UsersRepository;
    let userId: string;

    beforeEach(async () => {
      ({ sessions, users } = await createRepositories());
      userId = (await users.create(aUser())).id;
    });

    it('creates an unrevoked session, last used when it was created', async () => {
      const created = await sessions.create(aSession(userId));

      expect(created).toEqual({
        id: expect.any(String),
        userId,
        userAgent: 'Mozilla/5.0',
        ip: '203.0.113.7',
        createdAt: NOW,
        lastUsedAt: NOW,
        expiresAt: hoursFrom(NOW, 24),
        absoluteExpiresAt: hoursFrom(NOW, 72),
        revokedAt: null,
      });
      expect(await sessions.findById(created.id)).toEqual(created);
    });

    it('keeps a missing user agent and ip as null', async () => {
      const created = await sessions.create(aSession(userId, { userAgent: null, ip: null }));

      expect(created).toMatchObject({ userAgent: null, ip: null });
    });

    it('lists only the user’s active sessions, newest first', async () => {
      const otherUserId = (await users.create(aUser({ email: 'grace@example.com' }))).id;
      const older = await sessions.create(aSession(userId, { createdAt: hoursFrom(NOW, -2) }));
      const newer = await sessions.create(aSession(userId, { createdAt: hoursFrom(NOW, -1) }));
      const revoked = await sessions.create(aSession(userId));
      await sessions.revoke(revoked.id, NOW);
      await sessions.create(aSession(userId, { expiresAt: NOW }));
      await sessions.create(aSession(otherUserId));

      const active = await sessions.listActive(userId, NOW);

      expect(active.map((session) => session.id)).toEqual([newer.id, older.id]);
    });

    it('slides the expiry of a session when it is used', async () => {
      const session = await sessions.create(aSession(userId));
      const usedAt = hoursFrom(NOW, 1);

      const touched = await sessions.touch(session.id, usedAt, hoursFrom(usedAt, 24));

      expect(touched).toMatchObject({ lastUsedAt: usedAt, expiresAt: hoursFrom(usedAt, 24) });
      expect(await sessions.findById(session.id)).toEqual(touched);
    });

    it('never slides the expiry past the absolute expiry', async () => {
      const session = await sessions.create(aSession(userId, { expiresAt: hoursFrom(NOW, 70) }));
      const usedAt = hoursFrom(NOW, 60);

      const touched = await sessions.touch(session.id, usedAt, hoursFrom(usedAt, 24));

      expect(touched?.expiresAt).toEqual(hoursFrom(NOW, 72));
    });

    it('does not touch a revoked, expired or unknown session', async () => {
      const revoked = await sessions.create(aSession(userId));
      await sessions.revoke(revoked.id, NOW);
      const expired = await sessions.create(aSession(userId, { expiresAt: NOW }));

      expect(await sessions.touch(revoked.id, NOW, hoursFrom(NOW, 24))).toBeNull();
      expect(await sessions.touch(expired.id, NOW, hoursFrom(NOW, 24))).toBeNull();
      expect(await sessions.touch(UNKNOWN_ID, NOW, hoursFrom(NOW, 24))).toBeNull();
    });

    it('revokes a session once', async () => {
      const session = await sessions.create(aSession(userId));

      expect(await sessions.revoke(session.id, NOW)).toBe(true);
      expect(await sessions.revoke(session.id, hoursFrom(NOW, 1))).toBe(false);

      expect((await sessions.findById(session.id))?.revokedAt).toEqual(NOW);
    });

    it('lets only one of two concurrent revocations of a session succeed', async () => {
      const session = await sessions.create(aSession(userId));

      const results = await Promise.all([
        sessions.revoke(session.id, NOW),
        sessions.revoke(session.id, NOW),
      ]);

      expect(results.toSorted()).toEqual([false, true]);
    });

    it('revokes a session on behalf of a user only if it is theirs', async () => {
      const otherUserId = (await users.create(aUser({ email: 'grace@example.com' }))).id;
      const session = await sessions.create(aSession(userId));

      expect(await sessions.revoke(session.id, NOW, { userId: otherUserId })).toBe(false);
      expect((await sessions.findById(session.id))?.revokedAt).toBeNull();
      expect(await sessions.revoke(session.id, NOW, { userId })).toBe(true);
    });

    it('revokes all of a user’s sessions except one, returning the revoked ids', async () => {
      const otherUserId = (await users.create(aUser({ email: 'grace@example.com' }))).id;
      const kept = await sessions.create(aSession(userId));
      const first = await sessions.create(aSession(userId));
      const second = await sessions.create(aSession(userId));
      const alreadyRevoked = await sessions.create(aSession(userId));
      await sessions.revoke(alreadyRevoked.id, NOW);
      const otherUsers = await sessions.create(aSession(otherUserId));

      const revokedIds = await sessions.revokeAllForUser(userId, NOW, { exceptId: kept.id });

      expect(revokedIds.toSorted()).toEqual([first.id, second.id].toSorted());
      expect((await sessions.listActive(userId, NOW)).map((session) => session.id)).toEqual([
        kept.id,
      ]);
      expect((await sessions.findById(otherUsers.id))?.revokedAt).toBeNull();
    });

    it('revokes every session of a user when none is excepted', async () => {
      await sessions.create(aSession(userId));
      await sessions.create(aSession(userId));

      const revokedIds = await sessions.revokeAllForUser(userId, NOW);

      expect(revokedIds).toHaveLength(2);
      expect(await sessions.listActive(userId, NOW)).toEqual([]);
    });

    it('deletes the sessions that have expired', async () => {
      const expired = await sessions.create(aSession(userId, { expiresAt: hoursFrom(NOW, -1) }));
      const expiringNow = await sessions.create(aSession(userId, { expiresAt: NOW }));
      const active = await sessions.create(aSession(userId, { expiresAt: hoursFrom(NOW, 1) }));

      expect(await sessions.deleteExpired(NOW)).toBe(2);

      expect(await sessions.findById(expired.id)).toBeNull();
      expect(await sessions.findById(expiringNow.id)).toBeNull();
      expect(await sessions.findById(active.id)).not.toBeNull();
    });
  });
}
