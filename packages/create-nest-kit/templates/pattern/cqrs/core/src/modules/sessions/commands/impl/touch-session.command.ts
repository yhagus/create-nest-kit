import { Command } from '@nestjs/cqrs';
import type { Session } from '../../session.js';

/** Records a refresh, sliding the expiry. Null when the session can no longer be used. */
export class TouchSessionCommand extends Command<Session | null> {
  constructor(readonly sessionId: string) {
    super();
  }
}
