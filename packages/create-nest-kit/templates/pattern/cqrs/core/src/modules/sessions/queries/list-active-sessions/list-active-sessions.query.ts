import { Query } from '@nestjs/cqrs';
import type { Session } from '../../session.js';

/** The user's sessions that are neither revoked nor expired, newest first. */
export class ListActiveSessionsQuery extends Query<Session[]> {
  constructor(readonly userId: string) {
    super();
  }
}
