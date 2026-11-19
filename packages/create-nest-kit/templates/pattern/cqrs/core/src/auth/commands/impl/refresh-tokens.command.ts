import { Command } from '@nestjs/cqrs';
import type { IssuedTokens } from '../../auth.types.js';

/** Rotates the refresh token; a reused one revokes its session. @throws InvalidRefreshTokenException */
export class RefreshTokensCommand extends Command<IssuedTokens> {
  constructor(readonly refreshToken: string) {
    super();
  }
}
