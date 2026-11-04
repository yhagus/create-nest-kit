import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { aUser } from '../../../../../test/contracts/repositories.js';
import { createInMemoryRepositories } from '../../../../../test/fakes/in-memory-repositories.js';
import { handlerTestingModule } from '../../../../../test/support/handler-testing-module.js';
import { CreateSessionCommand } from '../../../sessions/commands/create-session/create-session.command.js';
import { IsSessionRevokedQuery } from '../../../sessions/queries/is-session-revoked/is-session-revoked.query.js';
import type { Session } from '../../../sessions/session.js';
import type { User } from '../../user.js';
import { UpdateUserCommand } from './update-user.command.js';

const DAY_MS = 86_400_000;

describe('UpdateUserHandler', () => {
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let user: User;
  let session: Session;

  beforeEach(async () => {
    const repositories = createInMemoryRepositories();
    const moduleRef = await handlerTestingModule({
      repositories,
      config: { REFRESH_TOKEN_TTL: DAY_MS, SESSION_ABSOLUTE_TTL: 3 * DAY_MS },
    }).compile();
    await moduleRef.init();
    commandBus = moduleRef.get(CommandBus);
    queryBus = moduleRef.get(QueryBus);
    user = await repositories.users.create(aUser({ email: 'ada@example.com' }));
    session = await commandBus.execute(
      new CreateSessionCommand({ userId: user.id, userAgent: null, ip: null }),
    );
  });

  it('signs the user out everywhere when an admin changes their password', async () => {
    const updated = await commandBus.execute(
      new UpdateUserCommand(user.id, { password: 'new password' }),
    );

    expect(updated.passwordHash).toBe('hashed:new password');
    expect(await queryBus.execute(new IsSessionRevokedQuery(session.id))).toBe(true);
  });

  it('keeps the user signed in when other fields change', async () => {
    await commandBus.execute(
      new UpdateUserCommand(user.id, { name: 'Ada King', emailVerified: false }),
    );

    expect(await queryBus.execute(new IsSessionRevokedQuery(session.id))).toBe(false);
  });
});
