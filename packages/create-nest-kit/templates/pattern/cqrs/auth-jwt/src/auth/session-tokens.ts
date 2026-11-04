import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { CreateSessionCommand } from '../modules/sessions/commands/create-session/create-session.command.js';
import { RevokeSessionCommand } from '../modules/sessions/commands/revoke-session/revoke-session.command.js';
import { TouchSessionCommand } from '../modules/sessions/commands/touch-session/touch-session.command.js';
import type { Session } from '../modules/sessions/session.js';
import { AccessTokens } from './access-tokens.js';
import { InvalidRefreshTokenException } from './auth.exceptions.js';
import type { Device, IssuedTokens } from './auth.types.js';
import { generateToken, hashToken } from './random-token.js';
import { RefreshTokensRepository } from './refresh-tokens.repository.js';

/** `<session id>.<secret>`: the session id lets a refresh find its row without scanning hashes. */
const REFRESH_TOKEN_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([\w-]{43})$/;

/**
 * Starts sessions and refreshes them: the access token, the rotating refresh token and the
 * session row. Shared by the login and refresh handlers.
 */
@Injectable()
export class SessionTokens {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly accessTokens: AccessTokens,
    private readonly refreshTokens: RefreshTokensRepository,
  ) {}

  async start(userId: string, device: Device): Promise<IssuedTokens> {
    const session = await this.commandBus.execute(new CreateSessionCommand({ userId, ...device }));
    const secret = generateToken();
    await this.refreshTokens.create(session.id, hashToken(secret));
    return this.issue(session, secret);
  }

  /**
   * Swaps a refresh token for a new pair. A token that was already rotated away means two
   * parties hold this session's tokens, so the whole session is revoked.
   */
  async refresh(refreshToken: string): Promise<IssuedTokens> {
    const [, sessionId, secret] = REFRESH_TOKEN_PATTERN.exec(refreshToken) ?? [];
    if (sessionId === undefined || secret === undefined) throw new InvalidRefreshTokenException();

    const nextSecret = generateToken();
    const rotated = await this.refreshTokens.rotate(
      sessionId,
      hashToken(secret),
      hashToken(nextSecret),
    );
    if (!rotated) {
      await this.commandBus.execute(new RevokeSessionCommand(sessionId));
      throw new InvalidRefreshTokenException();
    }

    const session = await this.commandBus.execute(new TouchSessionCommand(sessionId));
    if (!session) throw new InvalidRefreshTokenException();
    return this.issue(session, nextSecret);
  }

  private async issue(session: Session, refreshSecret: string): Promise<IssuedTokens> {
    const accessToken = await this.accessTokens.sign({ sub: session.userId, sid: session.id });
    return {
      tokens: {
        accessToken,
        refreshToken: `${session.id}.${refreshSecret}`,
        expiresIn: this.accessTokens.lifetimeSeconds,
        tokenType: 'Bearer',
      },
      refreshTokenExpiresAt: session.expiresAt,
    };
  }
}
