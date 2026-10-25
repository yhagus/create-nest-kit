import { afterAll, beforeAll } from 'vitest';
import { RolesRepository } from '../../src/modules/roles/roles.repository.js';
import { SessionsRepository } from '../../src/modules/sessions/sessions.repository.js';
import { UsersRepository } from '../../src/modules/users/users.repository.js';
import type { Repositories } from '../contracts/repositories.js';
import { describeRolesRepositoryContract } from '../contracts/roles-repository.contract.js';
import { describeSessionsRepositoryContract } from '../contracts/sessions-repository.contract.js';
import { describeUsersRepositoryContract } from '../contracts/users-repository.contract.js';
import { createTestApp, type TestApp } from '../support/app.js';

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp();
});

afterAll(async () => {
  await testApp.close();
});

async function createRepositories(): Promise<Repositories> {
  await testApp.reset();
  return {
    users: testApp.app.get(UsersRepository),
    roles: testApp.app.get(RolesRepository),
    sessions: testApp.app.get(SessionsRepository),
  };
}

describeUsersRepositoryContract(createRepositories);
describeRolesRepositoryContract(createRepositories);
describeSessionsRepositoryContract(createRepositories);
