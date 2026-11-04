import { NotFoundException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { aUser } from '../../../../../test/contracts/repositories.js';
import { createInMemoryRepositories } from '../../../../../test/fakes/in-memory-repositories.js';
import { handlerTestingModule } from '../../../../../test/support/handler-testing-module.js';
import { IsSessionRevokedQuery } from '../../queries/is-session-revoked/is-session-revoked.query.js';
import { ListActiveSessionsQuery } from '../../queries/list-active-sessions/list-active-sessions.query.js';
import { CreateSessionCommand } from '../create-session/create-session.command.js';
import { RevokeUserSessionCommand } from './revoke-user-session.command.js';

const HOUR_MS = 3_600_000;

describe('RevokeUserSessionHandler', () => {
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let userId: string;
  let otherUserId: string;

  beforeEach(async () => {
    const repositories = createInMemoryRepositories();
    userId = (await repositories.users.create(aUser({ email: 'ada@example.com' }))).id;
    otherUserId = (await repositories.users.create(aUser({ email: 'grace@example.com' }))).id;
    const moduleRef = await handlerTestingModule({
      repositories,
      config: { REFRESH_TOKEN_TTL: HOUR_MS, SESSION_ABSOLUTE_TTL: HOUR_MS },
    }).compile();
    await moduleRef.init();
    commandBus = moduleRef.get(CommandBus);
    queryBus = moduleRef.get(QueryBus);
  });

  it('answers 404 when a user revokes a session that is not theirs', async () => {
    const session = await commandBus.execute(
      new CreateSessionCommand({ userId: otherUserId, userAgent: null, ip: null }),
    );

    await expect(
      commandBus.execute(new RevokeUserSessionCommand(userId, session.id)),
    ).rejects.toThrow(NotFoundException);
    expect(await queryBus.execute(new IsSessionRevokedQuery(session.id))).toBe(false);
    const otherUsersSessions = await queryBus.execute(new ListActiveSessionsQuery(otherUserId));
    expect(otherUsersSessions.map(({ id }) => id)).toEqual([session.id]);
  });
});
