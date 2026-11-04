import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Session } from '../../session.js';
import { SessionsRepository } from '../../sessions.repository.js';
import { ListActiveSessionsQuery } from './list-active-sessions.query.js';

@QueryHandler(ListActiveSessionsQuery)
export class ListActiveSessionsHandler implements IQueryHandler<ListActiveSessionsQuery> {
  constructor(private readonly sessions: SessionsRepository) {}

  execute({ userId }: ListActiveSessionsQuery): Promise<Session[]> {
    return this.sessions.listActive(userId, new Date());
  }
}
