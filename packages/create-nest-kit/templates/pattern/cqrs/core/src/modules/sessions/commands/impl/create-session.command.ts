import { Command } from '@nestjs/cqrs';
import type { Session } from '../../session.js';

export interface NewDevice {
  userId: string;
  userAgent: string | null;
  ip: string | null;
}

/** Starts a session for a sign-in from this device. */
export class CreateSessionCommand extends Command<Session> {
  constructor(readonly device: NewDevice) {
    super();
  }
}
