import type { Session } from './session.js';

/** `lastUsedAt` starts at `createdAt`. */
export type NewSession = Pick<
  Session,
  'userId' | 'userAgent' | 'ip' | 'createdAt' | 'expiresAt' | 'absoluteExpiresAt'
>;

/**
 * Where sessions are stored. Every method is a single atomic statement (a conditional
 * UPDATE/DELETE), so concurrent refreshes and revocations can't interleave badly.
 * The persistence layer binds the implementation in `src/database/database.module.ts`;
 * `test/contracts/sessions-repository.contract.ts` is its spec.
 */
export abstract class SessionsRepository {
  abstract create(session: NewSession): Promise<Session>;

  abstract findById(id: string): Promise<Session | null>;

  /** The user's sessions that are active at `now`, newest first. */
  abstract listActive(userId: string, now: Date): Promise<Session[]>;

  /**
   * Records a use of an active session: sets `lastUsedAt` to `now` and slides `expiresAt` to
   * `expiresAt`, capped at `absoluteExpiresAt`. Null when the session is revoked, expired or unknown.
   */
  abstract touch(id: string, now: Date, expiresAt: Date): Promise<Session | null>;

  /**
   * Revokes the session unless it already is; with `userId`, only if it belongs to that user.
   * Returns whether this call revoked it.
   */
  abstract revoke(id: string, now: Date, options?: { userId?: string }): Promise<boolean>;

  /** Revokes the user's unrevoked sessions, except `exceptId`. Returns the ids it revoked. */
  abstract revokeAllForUser(
    userId: string,
    now: Date,
    options?: { exceptId?: string },
  ): Promise<string[]>;

  /** Deletes the sessions that expired at or before `now`. Returns how many. */
  abstract deleteExpired(now: Date): Promise<number>;
}
