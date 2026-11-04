import { Injectable } from '@nestjs/common';
import { MailQueue } from '../infra/mail/mail.queue.js';
import type { User } from '../modules/users/user.js';
import { VerificationTokens } from './verification-tokens.js';
import { VerificationPurpose } from './verification-tokens.repository.js';

/** Mails the user a new email-verification link. Shared by the register and resend handlers. */
@Injectable()
export class VerificationMailSender {
  constructor(
    private readonly verificationTokens: VerificationTokens,
    private readonly mailQueue: MailQueue,
  ) {}

  async send(user: User): Promise<void> {
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
