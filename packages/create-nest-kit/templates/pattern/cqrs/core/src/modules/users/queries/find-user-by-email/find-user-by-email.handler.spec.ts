import { QueryBus } from '@nestjs/cqrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { aUser } from '../../../../../test/contracts/repositories.js';
import {
  createInMemoryRepositories,
  type InMemoryRepositories,
} from '../../../../../test/fakes/in-memory-repositories.js';
import { handlerTestingModule } from '../../../../../test/support/handler-testing-module.js';
import { FindUserByEmailQuery } from './find-user-by-email.query.js';

describe('FindUserByEmailHandler', () => {
  let queryBus: QueryBus;
  let repositories: InMemoryRepositories;

  beforeEach(async () => {
    repositories = createInMemoryRepositories();
    const moduleRef = await handlerTestingModule({ repositories }).compile();
    await moduleRef.init();
    queryBus = moduleRef.get(QueryBus);
  });

  it('finds a user by email in any case', async () => {
    const created = await repositories.users.create(aUser({ email: 'ada@example.com' }));

    const found = await queryBus.execute(new FindUserByEmailQuery(' ADA@example.com'));

    expect(found?.id).toBe(created.id);
  });
});
