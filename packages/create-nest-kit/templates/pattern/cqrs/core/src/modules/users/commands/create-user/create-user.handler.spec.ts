import { CommandBus } from '@nestjs/cqrs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInMemoryRepositories,
  type InMemoryRepositories,
} from '../../../../../test/fakes/in-memory-repositories.js';
import { handlerTestingModule } from '../../../../../test/support/handler-testing-module.js';
import { Permission } from '../../../permissions/permission.js';
import { CreateUserCommand } from './create-user.command.js';

const NOW = new Date('2026-01-15T12:00:00.000Z');

describe('CreateUserHandler', () => {
  let commandBus: CommandBus;
  let repositories: InMemoryRepositories;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    repositories = createInMemoryRepositories();
    const moduleRef = await handlerTestingModule({ repositories }).compile();
    await moduleRef.init();
    commandBus = moduleRef.get(CommandBus);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a user with a hashed password, a normalized email and the given roles', async () => {
    const support = await repositories.roles.create({
      name: 'support',
      description: '',
      permissions: [Permission.UsersRead],
      isSystem: false,
    });

    const user = await commandBus.execute(
      new CreateUserCommand({
        email: '  Ada@Example.COM ',
        password: 'correct horse',
        name: 'Ada Lovelace',
        roleIds: [support.id],
        emailVerified: true,
      }),
    );

    expect(user).toMatchObject({
      email: 'ada@example.com',
      passwordHash: 'hashed:correct horse',
      emailVerifiedAt: NOW,
      roles: [{ id: support.id, name: 'support' }],
    });
  });
});
