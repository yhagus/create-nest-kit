import { Command } from '@nestjs/cqrs';
import type { Credentials, Device, SignedIn } from '../../auth.types.js';

/** Starts a session. @throws InvalidCredentialsException, EmailNotVerifiedException */
export class LoginCommand extends Command<SignedIn> {
  constructor(
    readonly credentials: Credentials,
    readonly device: Device,
  ) {
    super();
  }
}
