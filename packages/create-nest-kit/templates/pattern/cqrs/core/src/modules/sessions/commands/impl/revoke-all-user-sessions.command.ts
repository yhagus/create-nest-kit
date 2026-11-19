import { Command } from '@nestjs/cqrs';

/** Signs the user out of every session, except `exceptSessionId` when given. */
export class RevokeAllUserSessionsCommand extends Command<void> {
  constructor(
    readonly userId: string,
    readonly exceptSessionId?: string,
  ) {
    super();
  }
}
