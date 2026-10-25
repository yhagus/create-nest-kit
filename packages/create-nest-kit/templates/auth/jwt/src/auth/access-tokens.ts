import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfig } from '../config/app-config.js';

const MILLISECONDS_PER_SECOND = 1000;

/** The claims of an access token: the user (`sub`) and the session it belongs to (`sid`). */
export interface AccessTokenClaims {
  sub: string;
  sid: string;
}

/** HS256 JWTs signed with JWT_SECRET, valid for ACCESS_TOKEN_TTL (see AuthModule). */
@Injectable()
export class AccessTokens {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  /** In seconds, as `expiresIn` in the token response. */
  get lifetimeSeconds(): number {
    return Math.floor(this.config.get('ACCESS_TOKEN_TTL') / MILLISECONDS_PER_SECOND);
  }

  sign(claims: AccessTokenClaims): Promise<string> {
    return this.jwt.signAsync({ sub: claims.sub, sid: claims.sid });
  }

  /** The claims of a valid, unexpired token; null for anything else. */
  async verify(token: string): Promise<AccessTokenClaims | null> {
    let payload: object;
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      return null;
    }
    return isAccessTokenClaims(payload) ? { sub: payload.sub, sid: payload.sid } : null;
  }
}

function isAccessTokenClaims(payload: object): payload is AccessTokenClaims {
  return (
    'sub' in payload &&
    typeof payload.sub === 'string' &&
    'sid' in payload &&
    typeof payload.sid === 'string'
  );
}
