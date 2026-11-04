import { CommandBus } from '@nestjs/cqrs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createInMemoryRepositories,
  type InMemoryRepositories,
} from '../../../../../test/fakes/in-memory-repositories.js';
import { handlerTestingModule } from '../../../../../test/support/handler-testing-module.js';
import { ALL_PERMISSIONS, Permission } from '../../../permissions/permission.js';
import { UpdateRoleCommand } from '../update-role/update-role.command.js';
import { SyncSystemRolesCommand } from './sync-system-roles.command.js';

describe('SyncSystemRolesHandler', () => {
  let commandBus: CommandBus;
  let repositories: InMemoryRepositories;

  beforeEach(async () => {
    repositories = createInMemoryRepositories();
    const moduleRef = await handlerTestingModule({ repositories }).compile();
    await moduleRef.init();
    commandBus = moduleRef.get(CommandBus);
    await commandBus.execute(new SyncSystemRolesCommand());
  });

  it('creates admin with every permission and user with none', async () => {
    expect(await repositories.roles.findByName('admin')).toMatchObject({
      isSystem: true,
      permissions: ALL_PERMISSIONS,
    });
    expect(await repositories.roles.findByName('user')).toMatchObject({
      isSystem: true,
      permissions: [],
    });
  });

  it('gives admin back every permission on the next sync, and leaves user alone', async () => {
    const { admin, user } = await commandBus.execute(new SyncSystemRolesCommand());
    await repositories.roles.update(admin.id, { permissions: [Permission.UsersRead] });
    await commandBus.execute(
      new UpdateRoleCommand(user.id, { permissions: [Permission.UsersRead] }),
    );

    await commandBus.execute(new SyncSystemRolesCommand());

    expect((await repositories.roles.findById(admin.id))?.permissions).toEqual(ALL_PERMISSIONS);
    expect((await repositories.roles.findById(user.id))?.permissions).toEqual([
      Permission.UsersRead,
    ]);
  });
});
