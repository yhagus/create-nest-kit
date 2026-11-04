import type { TokenPair as OfficialTokenPair } from '@nestjs/authentication';
import type { Session } from '../modules/sessions/session.js';
import type { IssuedTokens } from './auth.types.js';

/** The `/auth` response for a pair `TokenService` issued. Shared by the login and refresh handlers. */
export function toIssuedTokens(pair: OfficialTokenPair, session: Session): IssuedTokens {
  return {
    tokens: {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      expiresIn: pair.expiresIn,
      tokenType: 'Bearer',
    },
    // The session's sliding expiry: the refresh token stops working with it.
    refreshTokenExpiresAt: session.expiresAt,
  };
}
