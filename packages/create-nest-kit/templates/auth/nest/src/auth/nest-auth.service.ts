import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  EmailVerificationService,
  PasswordResetService,
  RefreshTokenError,
  type TokenPair as OfficialTokenPair,
  TokenService,
} from '@nestjs/authentication';
import { AppConfig } from '../config/app-config.js';
import { MailQueue } from '../infra/mail/mail.queue.js';
import { SystemRoleName } from '../modules/roles/role.js';
import { RolesService } from '../modules/roles/roles.service.js';
import type { Session } from '../modules/sessions/session.js';
import { SessionsService } from '../modules/sessions/sessions.service.js';
import type { User } from '../modules/users/user.js';
import { UsersService } from '../modules/users/users.service.js';
import {
  EmailNotVerifiedException,
  InvalidCredentialsException,
  InvalidCurrentPasswordException,
  InvalidRefreshTokenException,
  InvalidTokenException,
} from './auth.exceptions.js';
import {
  AuthService,
  type Credentials,
  type Device,
  type IssuedTokens,
  type PasswordChange,
  type Registration,
  type SignedIn,
} from './auth.service.js';
import { PasswordHasher } from './password-hasher.js';

/**
 * The `/auth` flows on `@nestjs/authentication`. The package issues, rotates and revokes the
 * tokens and runs the mailed links; device sessions are ours (`SessionsService`), linked to the
 * package's refresh tokens by the `sid` claim every token of a sign-in carries.
 */
@Injectable()
export class NestAuthService extends AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly roles: RolesService,
    private readonly sessions: SessionsService,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly passwordReset: PasswordResetService,
    private readonly emailVerification: EmailVerificationService,
    private readonly storage: AuthenticationStorage,
    private readonly mailQueue: MailQueue,
    private readonly config: AppConfig,
  ) {
    super();
  }

  async register(registration: Registration): Promise<User> {
    const userRole = await this.roles.getRoleByName(SystemRoleName.User);
    const user = await this.users.createUser({ ...registration, roleIds: [userRole.id] });
    if (this.isEmailVerificationEnabled()) {
      await this.emailVerification.send({ id: user.id, email: user.email });
    }
    return user;
  }

  async login({ email, password }: Credentials, device: Device): Promise<SignedIn> {
    const user = await this.users.findByEmail(email);
    // Checked against a dummy hash for an unknown email too, so timing doesn't reveal accounts.
    const isPasswordCorrect = await this.passwordHasher.verify(
      password,
      user?.passwordHash ?? null,
    );
    if (!user || !isPasswordCorrect) throw new InvalidCredentialsException();
    if (this.isEmailVerificationEnabled() && user.emailVerifiedAt === null) {
      throw new EmailNotVerifiedException();
    }
    const session = await this.sessions.create({ userId: user.id, ...device });
    // Every access token of this sign-in, refreshed ones included, carries the session as `sid`.
    const pair = await this.tokens.issue(user.id, {
      method: 'password',
      claims: { sid: session.id },
    });
    return { user, ...issued(pair, session) };
  }

  /** A rotated-away token means two parties hold the session's tokens: the session is revoked. */
  async refresh(refreshToken: string): Promise<IssuedTokens> {
    const sessionId = await this.sessionIdOf(refreshToken);
    let pair: OfficialTokenPair;
    try {
      pair = await this.tokens.refresh(refreshToken);
    } catch (error) {
      if (!(error instanceof RefreshTokenError)) throw error;
      // The package revoked the token family; revoking the session stops its access tokens too.
      if (error.reason === 'reused' && sessionId !== undefined) {
        await this.sessions.revoke(sessionId);
      }
      throw new InvalidRefreshTokenException();
    }

    const session = sessionId === undefined ? null : await this.sessions.touch(sessionId);
    if (!session) {
      // The session expired or was revoked while this refresh ran.
      await this.tokens.revoke(pair.refreshToken);
      throw new InvalidRefreshTokenException();
    }
    return issued(pair, session);
  }

  logout(sessionId: string): Promise<void> {
    return this.sessions.revoke(sessionId);
  }

  async changePassword(
    user: User,
    sessionId: string,
    { currentPassword, newPassword }: PasswordChange,
  ): Promise<void> {
    if (!(await this.passwordHasher.verify(currentPassword, user.passwordHash))) {
      throw new InvalidCurrentPasswordException();
    }
    await this.users.changePassword(user.id, newPassword, sessionId);
    await this.mailQueue.enqueue({
      mail: 'password-changed',
      to: user.email,
      data: { name: user.name },
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return;
    // The package keeps older links working; the contract has a new one replace them.
    await this.storage.emailTokens.deleteUserEmailTokens(user.id, 'password-reset');
    // Mails the link in the background, through PasswordResetMailer.
    this.passwordReset.request(user.email);
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const reset = await this.passwordReset.reset(token, password);
    if (!reset) throw new InvalidTokenException();
    // The package ended its own sign-ins of the user; this ends the device sessions and,
    // through the deny-list, their access tokens.
    await this.sessions.revokeAllForUser(reset.userId);
  }

  async verifyEmail(token: string): Promise<void> {
    if (!(await this.emailVerification.verify(token))) throw new InvalidTokenException();
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || user.emailVerifiedAt !== null) return;
    await this.storage.emailTokens.deleteUserEmailTokens(user.id, 'email-verification');
    await this.emailVerification.send({ id: user.id, email: user.email });
  }

  private isEmailVerificationEnabled(): boolean {
    return this.config.get('EMAIL_VERIFICATION_ENABLED');
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

function issued(pair: OfficialTokenPair, session: Session): IssuedTokens {
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
