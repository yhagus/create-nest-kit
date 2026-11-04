import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SessionDenyList } from '../../session-deny-list.js';
import { IsSessionRevokedQuery } from './is-session-revoked.query.js';

@QueryHandler(IsSessionRevokedQuery)
export class IsSessionRevokedHandler implements IQueryHandler<IsSessionRevokedQuery> {
  constructor(private readonly denyList: SessionDenyList) {}

  execute({ sessionId }: IsSessionRevokedQuery): Promise<boolean> {
    return this.denyList.includes(sessionId);
  }
}
