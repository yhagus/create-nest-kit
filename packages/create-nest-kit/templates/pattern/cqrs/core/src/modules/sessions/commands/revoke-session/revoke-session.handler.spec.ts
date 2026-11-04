import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { aUser } from '../../../../../test/contracts/repositories.js';
import { createInMemoryRepositories } from '../../../../../test/fakes/in-memory-repositories.js';
import { handlerTestingModule } from '../../../../../test/support/handler-testing-module.js';
import { IsSessionRevokedQuery } from '../../queries/is-session-revoked/is-session-revoked.query.js';
import { ListActiveSessionsQuery } from '../../queries/list-active-sessions/list-active-sessions.query.js';
import type { Session } from '../../session.js';
import { SessionRevocationHook } from '../../session-revocation-hook.js';
import { CreateSessionCommand } from '../create-session/create-session.command.js';
import { RevokeSessionCommand } from './revoke-session.command.js';

const HOUR_MS = 3_600_000;

@Injectable()
@SessionRevocationHook()
class RecordingRevocationHook implements SessionRevocationHook {
  readonly revokedBatches: string[][] = [];

  async onSessionsRevoked(sessionIds: string[]): Promise<void> {
    this.revokedBatches.push(sessionIds);
  }
}

describe('RevokeSessionHandler', () => {
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let hook: RecordingRevocationHook;
  let userId: string;
  let session: Session;

  beforeEach(async () => {
    const repositories = createInMemoryRepositories();
    userId = (await repositories.users.create(aUser({ email: 'ada@example.com' }))).id;
    const moduleRef = await handlerTestingModule({
      repositories,
      config: { REFRESH_TOKEN_TTL: HOUR_MS, SESSION_ABSOLUTE_TTL: HOUR_MS },
      providers: [RecordingRevocationHook],
    }).compile();
    await moduleRef.init();
    commandBus = moduleRef.get(CommandBus);
    queryBus = moduleRef.get(QueryBus);
    hook = moduleRef.get(RecordingRevocationHook);
    session = await commandBus.execute(
      new CreateSessionCommand({ userId, userAgent: null, ip: null }),
    );
  });

  it('deny-lists a revoked session and tells the revocation hooks', async () => {
    await commandBus.execute(new RevokeSessionCommand(session.id));

    expect(await queryBus.execute(new IsSessionRevokedQuery(session.id))).toBe(true);
    expect(hook.revokedBatches).toEqual([[session.id]]);
    expect(await queryBus.execute(new ListActiveSessionsQuery(userId))).toEqual([]);
  });

  it('does not tell the hooks again about a session that was already revoked', async () => {
    await commandBus.execute(new RevokeSessionCommand(session.id));

    await commandBus.execute(new RevokeSessionCommand(session.id));

    expect(hook.revokedBatches).toHaveLength(1);
  });
});
