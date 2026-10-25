/**
 * What this app needs from the refresh-token store beyond `@nestjs/authentication`'s
 * `RefreshTokenStore`: each token row keeps the session it was issued for (`claims.sid`, saved
 * as `session_id`). Bound by the persistence layer in `src/database/auth-persistence.module.ts`,
 * next to the official stores; `test/contracts/authentication-stores.contract.ts` is its spec.
 */
export abstract class RefreshTokenFamilies {
  /**
   * Revokes the families of every refresh token issued for one of `sessionIds`, so that
   * `isRefreshTokenFamilyRevoked()` answers true for them, as `revokeRefreshTokenFamily()` does.
   */
  abstract revokeForSessions(sessionIds: readonly string[]): Promise<void>;
}
