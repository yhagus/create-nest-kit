import { Command } from '@nestjs/cqrs';

/** @throws InvalidTokenException */
export class VerifyEmailCommand extends Command<void> {
  constructor(readonly token: string) {
    super();
  }
}
