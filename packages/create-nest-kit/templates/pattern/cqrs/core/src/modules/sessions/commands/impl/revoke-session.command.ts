import { Command } from '@nestjs/cqrs';

/** Signs a session out; does nothing when it already is. */
export class RevokeSessionCommand extends Command<void> {
  constructor(readonly sessionId: string) {
    super();
  }
}
