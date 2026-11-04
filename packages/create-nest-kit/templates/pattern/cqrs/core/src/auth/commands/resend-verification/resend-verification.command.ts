import { Command } from '@nestjs/cqrs';

/** Mails a new verification link, invalidating older ones, if the email belongs to an unverified account. */
export class ResendVerificationCommand extends Command<void> {
  constructor(readonly email: string) {
    super();
  }
}
