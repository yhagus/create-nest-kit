import { Command } from '@nestjs/cqrs';
import type { User } from '../../../modules/users/user.js';
import type { PasswordChange } from '../../auth.types.js';

/**
 * Sets a new password, signs out every session but `sessionId` and mails a notice.
 * @throws InvalidCurrentPasswordException
 */
export class ChangePasswordCommand extends Command<void> {
  constructor(
    readonly user: User,
    readonly sessionId: string,
    readonly change: PasswordChange,
  ) {
    super();
  }
}
