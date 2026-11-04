import { CommandBus } from '@nestjs/cqrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aUser } from '../../../../../test/contracts/repositories.js';
import { createInMemoryRepositories } from '../../../../../test/fakes/in-memory-repositories.js';
import { handlerTestingModule } from '../../../../../test/support/handler-testing-module.js';
import { CreateSessionCommand } from '../create-session/create-session.command.js';
import { TouchSessionCommand } from './touch-session.command.js';

const NOW = new Date('2026-01-15T12:00:00.000Z');
const HOUR_MS = 3_600_000;
const REFRESH_TOKEN_TTL = 24 * HOUR_MS;
const SESSION_ABSOLUTE_TTL = 72 * HOUR_MS;

describe('TouchSessionHandler', () => {
  let commandBus: CommandBus;
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('slides the expiry from the time a session is used', async () => {
    const session = await commandBus.execute(
      new CreateSessionCommand({ userId, userAgent: null, ip: null }),
    );
    const usedAt = new Date(NOW.getTime() + 10 * HOUR_MS);
    vi.setSystemTime(usedAt);

    const touched = await commandBus.execute(new TouchSessionCommand(session.id));

    expect(touched).toMatchObject({
      lastUsedAt: usedAt,
      expiresAt: new Date(usedAt.getTime() + REFRESH_TOKEN_TTL),
    });
  });
});
