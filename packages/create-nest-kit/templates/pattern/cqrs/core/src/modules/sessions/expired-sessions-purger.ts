import { Injectable } from '@nestjs/common';
import { ExpiredDataPurger } from '../../infra/queue/expired-data-purger.js';
import { SessionsRepository } from './sessions.repository.js';

/** Deletes expired sessions in the daily maintenance job. */
@Injectable()
@ExpiredDataPurger()
export class ExpiredSessionsPurger implements ExpiredDataPurger {
  constructor(private readonly sessions: SessionsRepository) {}

  purgeExpired(now: Date): Promise<number> {
    return this.sessions.deleteExpired(now);
  }
}
