import { Injectable } from '@nestjs/common';
import { SessionRevocationHook } from '../modules/sessions/session-revocation-hook.js';
import { RefreshTokenFamilies } from './refresh-token-families.js';

/** Whenever sessions are revoked (logout, password change, admin, ...), their refresh tokens stop working. */
@Injectable()
@SessionRevocationHook()
export class RefreshTokenRevocationHook implements SessionRevocationHook {
  constructor(private readonly families: RefreshTokenFamilies) {}

  onSessionsRevoked(sessionIds: string[]): Promise<void> {
    return this.families.revokeForSessions(sessionIds);
  }
}
