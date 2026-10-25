import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  PasswordResetHandler,
  type PasswordResetAccount,
  type PasswordResetLink,
} from '@nestjs/authentication';
import { MailQueue } from '../infra/mail/mail.queue.js';
import { UsersRepository } from '../modules/users/users.repository.js';
import { tokenOf } from './link-token.js';

/** What `PasswordResetService` needs from the app: the accounts, the mail and the new password. */
@Injectable()
export class PasswordResetMailer extends PasswordResetHandler {
  constructor(
    private readonly users: UsersRepository,
    private readonly mailQueue: MailQueue,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler('passwordReset', this);
  }

  async findUser(email: string): Promise<PasswordResetAccount | null> {
    const user = await this.users.findByEmail(email);
    return user && { id: user.id, email: user.email, passwordHash: user.passwordHash };
  }

  async send(link: PasswordResetLink): Promise<void> {
    const user = await this.users.findById(link.userId);
    if (!user) return;
    await this.mailQueue.enqueue({
      mail: 'reset-password',
      to: link.email,
      data: { name: user.name, token: tokenOf(link) },
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.users.update(userId, { passwordHash });
  }
}
