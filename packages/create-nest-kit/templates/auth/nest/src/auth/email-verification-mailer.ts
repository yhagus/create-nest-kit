import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  EmailVerificationHandler,
  type EmailVerificationLink,
} from '@nestjs/authentication';
import { MailQueue } from '../infra/mail/mail.queue.js';
import type { User } from '../modules/users/user.js';
import { UsersRepository } from '../modules/users/users.repository.js';
import { tokenOf } from './link-token.js';

/** What `EmailVerificationService` needs from the app: the mail, and `users.email_verified_at`. */
@Injectable()
export class EmailVerificationMailer extends EmailVerificationHandler {
  constructor(
    private readonly users: UsersRepository,
    private readonly mailQueue: MailQueue,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler('emailVerification', this);
  }

  async send(link: EmailVerificationLink): Promise<void> {
    const user = await this.users.findById(link.userId);
    if (!user) return;
    await this.mailQueue.enqueue({
      mail: 'verify-email',
      to: link.email,
      data: { name: user.name, token: tokenOf(link) },
    });
  }

  /** Only while the user still has the address the link went to. */
  async markVerified(userId: string, email: string): Promise<boolean> {
    // A read, then a write: UsersRepository has no conditional update. Only an admin can
    // change an address, so one changed in between is unlikely enough to accept.
    const user = await this.users.findById(userId);
    if (!user || user.email !== email) return false;
    if (user.emailVerifiedAt === null) {
      await this.users.update(userId, { emailVerifiedAt: new Date() });
    }
    return true;
  }

  override isVerified(user: User): boolean {
    return user.emailVerifiedAt !== null;
  }
}
