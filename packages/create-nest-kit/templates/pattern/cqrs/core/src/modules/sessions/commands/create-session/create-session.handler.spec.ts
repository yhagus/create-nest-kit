import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aUser } from '../../../../../test/contracts/repositories.js';
import { createInMemoryRepositories } from '../../../../../test/fakes/in-memory-repositories.js';
import { handlerTestingModule } from '../../../../../test/support/handler-testing-module.js';
import { ListActiveSessionsQuery } from '../../queries/list-active-sessions/list-active-sessions.query.js';
import { CreateSessionCommand } from './create-session.command.js';

const NOW = new Date('2026-01-15T12:00:00.000Z');
const HOUR_MS = 3_600_000;
const REFRESH_TOKEN_TTL = 24 * HOUR_MS;
const SESSION_ABSOLUTE_TTL = 72 * HOUR_MS;

describe('CreateSessionHandler', () => {
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let userId: string;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    const repositories = createInMemoryRepositories();
    userId = (await repositories.users.create(aUser({ email: 'ada@example.com' }))).id;
    const moduleRef = await handlerTestingModule({
      repositories,
      config: { REFRESH_TOKEN_TTL, SESSION_ABSOLUTE_TTL },
    }).compile();
    await moduleRef.init();
    commandBus = moduleRef.get(CommandBus);
    queryBus = moduleRef.get(QueryBus);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a session that expires after the refresh token lifetime', async () => {
    const session = await commandBus.execute(
      new CreateSessionCommand({ userId, userAgent: 'Mozilla/5.0', ip: '203.0.113.7' }),
    );

    expect(session).toMatchObject({
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() + REFRESH_TOKEN_TTL),
      absoluteExpiresAt: new Date(NOW.getTime() + SESSION_ABSOLUTE_TTL),
    });
    const activeSessions = await queryBus.execute(new ListActiveSessionsQuery(userId));
    expect(activeSessions.map(({ id }) => id)).toEqual([session.id]);
  });
});
