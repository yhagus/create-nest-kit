import { NotFoundException } from '@nestjs/common';
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
import { GetUserQuery } from '../../queries/get-user/get-user.query.js';
import { DeleteUserCommand } from './delete-user.command.js';

const DAY_MS = 86_400_000;

describe('DeleteUserHandler', () => {
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let repositories: InMemoryRepositories;

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

  it('revokes the sessions of a deleted user', async () => {
    const admin = await repositories.users.create(aUser({ email: 'admin@example.com' }));
    const user = await repositories.users.create(aUser({ email: 'ada@example.com' }));
    const session = await commandBus.execute(
      new CreateSessionCommand({ userId: user.id, userAgent: null, ip: null }),
    );

    await commandBus.execute(new DeleteUserCommand(user.id, admin.id));

    expect(await queryBus.execute(new IsSessionRevokedQuery(session.id))).toBe(true);
    await expect(queryBus.execute(new GetUserQuery(user.id))).rejects.toThrow(NotFoundException);
  });
});
