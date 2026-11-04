import { Command } from '@nestjs/cqrs';

/**
 * The user's own password change: signs out every session except the one they made it from.
 * @throws UserNotFoundException
 */
export class SetPasswordCommand extends Command<void> {
  constructor(
    readonly userId: string,
    readonly newPassword: string,
    readonly keepSessionId: string,
  ) {
    super();
  }
}
