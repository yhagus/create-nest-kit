import { Command } from '@nestjs/cqrs';

/** Signs out one of the user's sessions; 404 when it isn't theirs or is already revoked. */
export class RevokeUserSessionCommand extends Command<void> {
  constructor(
    readonly userId: string,
    readonly sessionId: string,
  ) {
    super();
  }
}
