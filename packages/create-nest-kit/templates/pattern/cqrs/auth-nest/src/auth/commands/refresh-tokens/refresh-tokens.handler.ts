import { createHash } from 'node:crypto';
import {
  AuthenticationStorage,
  RefreshTokenError,
  type TokenPair as OfficialTokenPair,
  TokenService,
} from '@nestjs/authentication';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { RevokeSessionCommand } from '../../../modules/sessions/commands/revoke-session/revoke-session.command.js';
import { TouchSessionCommand } from '../../../modules/sessions/commands/touch-session/touch-session.command.js';
import { InvalidRefreshTokenException } from '../../auth.exceptions.js';
import type { IssuedTokens } from '../../auth.types.js';
import { toIssuedTokens } from '../../issued-tokens.js';
import { RefreshTokensCommand } from './refresh-tokens.command.js';

/**
 * `TokenService` rotates the refresh token; the device session it was issued for (its `sid`
 * claim) is touched, or revoked when a rotated-away token means two parties hold its tokens.
 */
@CommandHandler(RefreshTokensCommand)
export class RefreshTokensHandler implements ICommandHandler<RefreshTokensCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly tokens: TokenService,
    private readonly storage: AuthenticationStorage,
  ) {}

  async execute({ refreshToken }: RefreshTokensCommand): Promise<IssuedTokens> {
    const sessionId = await this.sessionIdOf(refreshToken);
    let pair: OfficialTokenPair;
    try {
      pair = await this.tokens.refresh(refreshToken);
    } catch (error) {
      if (!(error instanceof RefreshTokenError)) throw error;
      // The package revoked the token family; revoking the session stops its access tokens too.
      if (error.reason === 'reused' && sessionId !== undefined) {
        await this.commandBus.execute(new RevokeSessionCommand(sessionId));
      }
      throw new InvalidRefreshTokenException();
    }

    const session =
      sessionId === undefined
        ? null
        : await this.commandBus.execute(new TouchSessionCommand(sessionId));
    if (!session) {
      // The session expired or was revoked while this refresh ran.
      await this.tokens.revoke(pair.refreshToken);
      throw new InvalidRefreshTokenException();
    }
    return toIssuedTokens(pair, session);
  }

  /** The session a refresh token was issued for; undefined for an unknown token. */
  private async sessionIdOf(refreshToken: string): Promise<string | undefined> {
    const record = await this.storage.refreshTokens.getRefreshToken(refreshTokenId(refreshToken));
    const sessionId = record?.claims?.['sid'];
    return typeof sessionId === 'string' ? sessionId : undefined;
  }
}

/** The key the package stores a refresh token under (`RefreshTokenRecord.id`): its SHA-256, base64url. */
function refreshTokenId(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('base64url');
}
