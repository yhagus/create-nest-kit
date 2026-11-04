import { CommandBus } from '@nestjs/cqrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryRepositories } from '../../../../../test/fakes/in-memory-repositories.js';
import { handlerTestingModule } from '../../../../../test/support/handler-testing-module.js';
import { Permission } from '../../../permissions/permission.js';
import { CreateRoleCommand } from './create-role.command.js';

describe('CreateRoleHandler', () => {
  let commandBus: CommandBus;

  beforeEach(async () => {
    const moduleRef = await handlerTestingModule({
      repositories: createInMemoryRepositories(),
    }).compile();
    await moduleRef.init();
    commandBus = moduleRef.get(CommandBus);
  });

  it('creates a custom role, granting each permission once', async () => {
    const role = await commandBus.execute(
      new CreateRoleCommand({
        name: 'support',
        permissions: [Permission.UsersRead, Permission.SessionsRead, Permission.UsersRead],
      }),
    );

    expect(role).toMatchObject({
      name: 'support',
      description: '',
      permissions: [Permission.UsersRead, Permission.SessionsRead],
      isSystem: false,
    });
  });
});
