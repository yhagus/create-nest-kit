import { Injectable } from '@nestjs/common';
import {
  AuthenticationError,
  AuthenticationRegistry,
  JwtBearerProvider,
  type JwtClaims,
} from '@nestjs/authentication';
import { SessionDenyList } from '../modules/sessions/session-deny-list.js';
import type { User } from '../modules/users/user.js';
import { UsersRepository } from '../modules/users/users.repository.js';

/**
 * Authenticates `Authorization: Bearer <access token>`, the tokens `TokenService` signs. Rejects
 * a token whose session was revoked, so a sign-out takes effect before the token expires.
 */
@Injectable()
export class AccessTokenProvider extends JwtBearerProvider<User> {
  constructor(
    private readonly users: UsersRepository,
    private readonly denyList: SessionDenyList,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  protected async validate({ sub, sid }: JwtClaims): Promise<User | null> {
    if (typeof sub !== 'string' || typeof sid !== 'string') return null;
    if (await this.denyList.includes(sid)) throw new AuthenticationError('Session revoked');
    return this.users.findById(sub);
  }
}
