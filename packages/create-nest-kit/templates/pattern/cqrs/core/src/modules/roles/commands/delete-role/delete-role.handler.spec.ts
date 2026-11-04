import { NotFoundException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryRepositories } from '../../../../../test/fakes/in-memory-repositories.js';
import { handlerTestingModule } from '../../../../../test/support/handler-testing-module.js';
import { GetRoleQuery } from '../../queries/get-role/get-role.query.js';
import { CreateRoleCommand } from '../create-role/create-role.command.js';
import { DeleteRoleCommand } from './delete-role.command.js';

describe('DeleteRoleHandler', () => {
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  beforeEach(async () => {
    const moduleRef = await handlerTestingModule({
      repositories: createInMemoryRepositories(),
    }).compile();
    await moduleRef.init();
    commandBus = moduleRef.get(CommandBus);
    queryBus = moduleRef.get(QueryBus);
  });

  it('deletes a custom role', async () => {
    const role = await commandBus.execute(
      new CreateRoleCommand({ name: 'support', permissions: [] }),
    );

    await commandBus.execute(new DeleteRoleCommand(role.id));

    await expect(queryBus.execute(new GetRoleQuery(role.id))).rejects.toThrow(NotFoundException);
  });
});
