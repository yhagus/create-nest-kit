import type {
  EmailTokenStore,
  RefreshTokenRecord,
  RefreshTokenStore,
  SessionStore,
} from '@nestjs/authentication';
import { authenticationStoreContract } from '@nestjs/authentication/testing';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { RefreshTokenFamilies } from '../../src/auth/refresh-token-families.js';
import type { ExpiredDataPurger } from '../../src/infra/queue/expired-data-purger.js';
import type { SessionsRepository } from '../../src/modules/sessions/sessions.repository.js';
import type { UsersRepository } from '../../src/modules/users/users.repository.js';
import { aSession, aUser, hoursFrom, NOW } from './repositories.js';

/** The stores a persistence layer registers with `AuthenticationStorage`. */
export interface AuthenticationStoreSources {
  refreshTokens: RefreshTokenStore;
  emailTokens: EmailTokenStore;
  sessions: SessionStore;
}

/** The persistence layer's auth stores, plus the domain repositories their rows reference. */
export interface AuthenticationStores {
  users: UsersRepository;
  sessions: SessionsRepository;
  sources: AuthenticationStoreSources;
  families: RefreshTokenFamilies;
  /** The store's `@ExpiredDataPurger()`. */
  purger: ExpiredDataPurger;
}

/** Called before each contract test; returns stores over an empty database. */
export type AuthenticationStoresFactory = () => Promise<AuthenticationStores>;

function aRefreshToken(
  userId: string,
  overrides: Partial<RefreshTokenRecord> = {},
): RefreshTokenRecord {
  return {
    id: `token-${randomUUID()}`,
    familyId: `family-${randomUUID()}`,
    userId,
    createdAt: hoursFrom(NOW, -2),
    expiresAt: hoursFrom(NOW, 1),
    familyExpiresAt: hoursFrom(NOW, 24),
    ...overrides,
  };
}

/**
 * The behaviour every implementation of the `@nestjs/authentication` stores must have: the
 * package's own suite, with its concurrency cases, then what this app adds to it.
 */
export function describeAuthenticationStoresContract(create: AuthenticationStoresFactory): void {
  describe('@nestjs/authentication store contract', () => {
    const cases = authenticationStoreContract(async () => (await create()).sources, {
      contracts: ['refreshTokens', 'emailTokens', 'sessions'],
      concurrent: true,
    });
    it.each(cases)('$name', async ({ run }) => {
      // Each case rejects with an assertion error naming the rule its store broke.
      await expect(run()).resolves.toBeUndefined();
    });
  });

  describe('RefreshTokenFamilies contract', () => {
    let stores: AuthenticationStores;
    let userId: string;

    beforeEach(async () => {
      stores = await create();
      userId = (await stores.users.create(aUser())).id;
    });

    it('revokes the families of the given sessions, and only those', async () => {
      const laptop = await stores.sessions.create(aSession(userId));
      const phone = await stores.sessions.create(aSession(userId));
      const laptopToken = aRefreshToken(userId, { claims: { sid: laptop.id } });
      const phoneToken = aRefreshToken(userId, { claims: { sid: phone.id } });
      await stores.sources.refreshTokens.saveRefreshToken(laptopToken);
      await stores.sources.refreshTokens.saveRefreshToken(phoneToken);

      await stores.families.revokeForSessions([laptop.id]);

      const { refreshTokens } = stores.sources;
      expect(await refreshTokens.isRefreshTokenFamilyRevoked(laptopToken.familyId)).toBe(true);
      expect(await refreshTokens.isRefreshTokenFamilyRevoked(phoneToken.familyId)).toBe(false);
    });
  });

  describe('refresh tokens of deleted owners', () => {
    let stores: AuthenticationStores;
    let userId: string;

    beforeEach(async () => {
      stores = await create();
      userId = (await stores.users.create(aUser())).id;
    });

    it('deletes a user’s refresh tokens with the user', async () => {
      const session = await stores.sessions.create(aSession(userId));
      const token = aRefreshToken(userId, { claims: { sid: session.id } });
      await stores.sources.refreshTokens.saveRefreshToken(token);

      await stores.users.delete(userId);

      expect(await stores.sources.refreshTokens.getRefreshToken(token.id)).toBeUndefined();
    });

    it('deletes the refresh tokens of expired sessions with the sessions', async () => {
      const { sessions, sources } = stores;
      const expired = await sessions.create(aSession(userId, { expiresAt: hoursFrom(NOW, -1) }));
      const active = await sessions.create(aSession(userId));
      const expiredToken = aRefreshToken(userId, { claims: { sid: expired.id } });
      const activeToken = aRefreshToken(userId, { claims: { sid: active.id } });
      await sources.refreshTokens.saveRefreshToken(expiredToken);
      await sources.refreshTokens.saveRefreshToken(activeToken);

      await sessions.deleteExpired(NOW);

      expect(await sources.refreshTokens.getRefreshToken(expiredToken.id)).toBeUndefined();
      expect(await sources.refreshTokens.getRefreshToken(activeToken.id)).toBeDefined();
    });
  });

  describe('purge of expired authentication data', () => {
    let stores: AuthenticationStores;

    beforeEach(async () => {
      stores = await create();
    });

    it('deletes expired token families and links, keeping live ones', async () => {
      const { refreshTokens, emailTokens } = stores.sources;
      const expiredFamily = aRefreshToken('user-1', { familyExpiresAt: NOW, expiresAt: NOW });
      const liveFamily = aRefreshToken('user-1');
      await refreshTokens.saveRefreshToken(expiredFamily);
      await refreshTokens.saveRefreshToken(liveFamily);
      const link = {
        purpose: 'email-verification',
        userId: 'user-1',
        email: 'ada@example.com',
        createdAt: hoursFrom(NOW, -2),
      } as const;
      await emailTokens.saveEmailToken({ ...link, id: 'expired-link', expiresAt: NOW });
      await emailTokens.saveEmailToken({ ...link, id: 'live-link', expiresAt: hoursFrom(NOW, 1) });

      expect(await stores.purger.purgeExpired(NOW)).toBe(2);

      expect(await refreshTokens.getRefreshToken(expiredFamily.id)).toBeUndefined();
      expect(await refreshTokens.getRefreshToken(liveFamily.id)).toBeDefined();
      expect(await emailTokens.consumeEmailToken('live-link', link.purpose)).toBeDefined();
    });
  });
}
