import { Command } from '@nestjs/cqrs';

/** Sets the password and signs out every session. @throws InvalidTokenException */
export class ResetPasswordCommand extends Command<void> {
  constructor(
    readonly token: string,
    readonly password: string,
  ) {
    super();
  }
}
