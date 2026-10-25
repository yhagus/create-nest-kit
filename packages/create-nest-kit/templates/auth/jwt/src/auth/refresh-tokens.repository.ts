/**
 * The hash of each session's current refresh token. Bound by the persistence layer in
 * `src/database/auth-persistence.module.ts`; `test/contracts/refresh-tokens-repository.contract.ts`
 * is its spec. The row goes when its session is deleted.
 */
export abstract class RefreshTokensRepository {
  /** Stores the first refresh token of a new session. */
  abstract create(sessionId: string, tokenHash: string): Promise<void>;

  /**
   * Replaces the session's token hash with `nextHash` if, and only if, it is still `currentHash`,
   * in one atomic compare-and-set. False when the session has another token (this one was
   * already rotated) or none.
   */
  abstract rotate(sessionId: string, currentHash: string, nextHash: string): Promise<boolean>;
}
