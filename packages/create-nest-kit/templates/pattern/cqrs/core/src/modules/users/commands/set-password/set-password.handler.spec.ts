import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { aUser } from '../../../../../test/contracts/repositories.js';
import {
  createInMemoryRepositories,
  type InMemoryRepositories,
} from '../../../../../test/fakes/in-memory-repositories.js';
import { handlerTestingModule } from '../../../../../test/support/handler-testing-module.js';
import { CreateSessionCommand } from '../../../sessions/commands/create-session/create-session.command.js';
import { IsSessionRevokedQuery } from '../../../sessions/queries/is-session-revoked/is-session-revoked.query.js';
import { SetPasswordCommand } from './set-password.command.js';

const DAY_MS = 86_400_000;

describe('SetPasswordHandler', () => {
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let repositories: InMemoryRepositories;

  const signIn = (userId: string) =>
    commandBus.execute(new CreateSessionCommand({ userId, userAgent: null, ip: null }));

  beforeEach(async () => {
    repositories = createInMemoryRepositories();
    const moduleRef = await handlerTestingModule({
      repositories,
      config: { REFRESH_TOKEN_TTL: DAY_MS, SESSION_ABSOLUTE_TTL: 3 * DAY_MS },
    }).compile();
    await moduleRef.init();
    commandBus = moduleRef.get(CommandBus);
    queryBus = moduleRef.get(QueryBus);
  });

  it('keeps only the current session when a user changes their own password', async () => {
    const user = await repositories.users.create(aUser({ email: 'ada@example.com' }));
    const current = await signIn(user.id);
    const other = await signIn(user.id);

    await commandBus.execute(new SetPasswordCommand(user.id, 'new password', current.id));

    expect((await repositories.users.findById(user.id))?.passwordHash).toBe('hashed:new password');
    expect(await queryBus.execute(new IsSessionRevokedQuery(current.id))).toBe(false);
    expect(await queryBus.execute(new IsSessionRevokedQuery(other.id))).toBe(true);
  });
});
