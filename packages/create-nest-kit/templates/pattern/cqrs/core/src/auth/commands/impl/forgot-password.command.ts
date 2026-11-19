import { Command } from '@nestjs/cqrs';

/** Mails a reset link if an account has this email; silently does nothing otherwise. */
export class ForgotPasswordCommand extends Command<void> {
  constructor(readonly email: string) {
    super();
  }
}
