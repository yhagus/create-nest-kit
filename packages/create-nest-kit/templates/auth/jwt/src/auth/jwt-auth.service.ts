import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config.js';
import { MailQueue } from '../infra/mail/mail.queue.js';
import { SystemRoleName } from '../modules/roles/role.js';
import { RolesService } from '../modules/roles/roles.service.js';
import { SessionsService } from '../modules/sessions/sessions.service.js';
import type { User } from '../modules/users/user.js';
import { UsersService } from '../modules/users/users.service.js';
import {
  EmailNotVerifiedException,
  InvalidCredentialsException,
  InvalidCurrentPasswordException,
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
import { SessionTokens } from './session-tokens.js';
import { VerificationTokens } from './verification-tokens.js';
import { VerificationPurpose } from './verification-tokens.repository.js';

/** The hand-rolled implementation of the `/auth` flows. */
@Injectable()
export class JwtAuthService extends AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly roles: RolesService,
    private readonly sessions: SessionsService,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionTokens: SessionTokens,
    private readonly verificationTokens: VerificationTokens,
    private readonly mailQueue: MailQueue,
    private readonly config: AppConfig,
  ) {
    super();
  }

  async register(registration: Registration): Promise<User> {
    const userRole = await this.roles.getRoleByName(SystemRoleName.User);
    const user = await this.users.createUser({ ...registration, roleIds: [userRole.id] });
    if (this.isEmailVerificationEnabled()) {
      await this.sendVerificationMail(user);
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
    return { user, ...(await this.sessionTokens.start(user.id, device)) };
  }

  refresh(refreshToken: string): Promise<IssuedTokens> {
    return this.sessionTokens.refresh(refreshToken);
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
    const token = await this.verificationTokens.issue(user.id, VerificationPurpose.PasswordReset);
    await this.mailQueue.enqueue({
      mail: 'reset-password',
      to: user.email,
      data: { name: user.name, token },
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const userId = await this.verificationTokens.consume(VerificationPurpose.PasswordReset, token);
    if (userId === null) throw new InvalidTokenException();
    // A new password signs the user out of every session. The mailed link also proves the user
    // owns the address, so an unverified one becomes verified.
    await this.users.updateUser(userId, { password });
    await this.users.markEmailVerified(userId);
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.verificationTokens.consume(
      VerificationPurpose.EmailVerification,
      token,
    );
    if (userId === null) throw new InvalidTokenException();
    await this.users.markEmailVerified(userId);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || user.emailVerifiedAt !== null) return;
    await this.sendVerificationMail(user);
  }

  private isEmailVerificationEnabled(): boolean {
    return this.config.get('EMAIL_VERIFICATION_ENABLED');
  }

  private async sendVerificationMail(user: User): Promise<void> {
    const token = await this.verificationTokens.issue(
      user.id,
      VerificationPurpose.EmailVerification,
    );
    await this.mailQueue.enqueue({
      mail: 'verify-email',
      to: user.email,
      data: { name: user.name, token },
    });
  }
}
