import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { aUser } from '../../../../../test/contracts/repositories.js';
import { createInMemoryRepositories } from '../../../../../test/fakes/in-memory-repositories.js';
import { handlerTestingModule } from '../../../../../test/support/handler-testing-module.js';
import { IsSessionRevokedQuery } from '../../queries/is-session-revoked/is-session-revoked.query.js';
import { ListActiveSessionsQuery } from '../../queries/list-active-sessions/list-active-sessions.query.js';
import { SessionRevocationHook } from '../../session-revocation-hook.js';
import { CreateSessionCommand } from '../create-session/create-session.command.js';
import { RevokeAllUserSessionsCommand } from './revoke-all-user-sessions.command.js';

const HOUR_MS = 3_600_000;

@Injectable()
@SessionRevocationHook()
class RecordingRevocationHook implements SessionRevocationHook {
  readonly revokedBatches: string[][] = [];

  async onSessionsRevoked(sessionIds: string[]): Promise<void> {
    this.revokedBatches.push(sessionIds);
  }
}

describe('RevokeAllUserSessionsHandler', () => {
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let hook: RecordingRevocationHook;
  let userId: string;
  let otherUserId: string;

  const signIn = (forUserId: string) =>
    commandBus.execute(new CreateSessionCommand({ userId: forUserId, userAgent: null, ip: null }));

  const activeSessionIds = async (forUserId: string) =>
    (await queryBus.execute(new ListActiveSessionsQuery(forUserId))).map(({ id }) => id);

  const isRevoked = (sessionId: string) => queryBus.execute(new IsSessionRevokedQuery(sessionId));

  beforeEach(async () => {
    const repositories = createInMemoryRepositories();
    userId = (await repositories.users.create(aUser({ email: 'ada@example.com' }))).id;
    otherUserId = (await repositories.users.create(aUser({ email: 'grace@example.com' }))).id;
    const moduleRef = await handlerTestingModule({
      repositories,
      config: { REFRESH_TOKEN_TTL: HOUR_MS, SESSION_ABSOLUTE_TTL: HOUR_MS },
      providers: [RecordingRevocationHook],
    }).compile();
    await moduleRef.init();
    commandBus = moduleRef.get(CommandBus);
    queryBus = moduleRef.get(QueryBus);
    hook = moduleRef.get(RecordingRevocationHook);
  });

  it('revokes all of a user’s other sessions in one batch', async () => {
    const current = await signIn(userId);
    const laptop = await signIn(userId);
    const phone = await signIn(userId);
    const otherUsers = await signIn(otherUserId);

    await commandBus.execute(new RevokeAllUserSessionsCommand(userId, current.id));

    expect(await activeSessionIds(userId)).toEqual([current.id]);
    expect(await isRevoked(laptop.id)).toBe(true);
    expect(await isRevoked(phone.id)).toBe(true);
    expect(hook.revokedBatches.map((batch) => batch.toSorted())).toEqual([
      [laptop.id, phone.id].toSorted(),
    ]);
    expect(await activeSessionIds(otherUserId)).toEqual([otherUsers.id]);
  });
});
