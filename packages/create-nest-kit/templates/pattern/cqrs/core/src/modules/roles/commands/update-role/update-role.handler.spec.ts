import { CommandBus } from '@nestjs/cqrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryRepositories } from '../../../../../test/fakes/in-memory-repositories.js';
import { handlerTestingModule } from '../../../../../test/support/handler-testing-module.js';
import { SyncSystemRolesCommand } from '../sync-system-roles/sync-system-roles.command.js';
import { UpdateRoleCommand } from './update-role.command.js';

describe('UpdateRoleHandler', () => {
  let commandBus: CommandBus;

  beforeEach(async () => {
    const moduleRef = await handlerTestingModule({
      repositories: createInMemoryRepositories(),
    }).compile();
    await moduleRef.init();
    commandBus = moduleRef.get(CommandBus);
  });

  it('lets a system role change its description, sent along with its unchanged name', async () => {
    const { user } = await commandBus.execute(new SyncSystemRolesCommand());

    const updated = await commandBus.execute(
      new UpdateRoleCommand(user.id, { name: 'user', description: 'Everyone who signed up' }),
    );

    expect(updated.description).toBe('Everyone who signed up');
  });
});
