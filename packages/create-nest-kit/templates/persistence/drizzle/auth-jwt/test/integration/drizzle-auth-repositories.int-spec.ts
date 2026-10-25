import { afterAll, beforeAll } from 'vitest';
import { RefreshTokensRepository } from '../../src/auth/refresh-tokens.repository.js';
import { VerificationTokensRepository } from '../../src/auth/verification-tokens.repository.js';
import { SessionsRepository } from '../../src/modules/sessions/sessions.repository.js';
import { UsersRepository } from '../../src/modules/users/users.repository.js';
import type { AuthRepositories } from '../contracts/auth-repositories.js';
import { describeRefreshTokensRepositoryContract } from '../contracts/refresh-tokens-repository.contract.js';
import { describeVerificationTokensRepositoryContract } from '../contracts/verification-tokens-repository.contract.js';
import { createTestApp, type TestApp } from '../support/app.js';

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp();
});

afterAll(async () => {
  await testApp.close();
});

async function createRepositories(): Promise<AuthRepositories> {
  await testApp.reset();
  return {
    users: testApp.app.get(UsersRepository),
    sessions: testApp.app.get(SessionsRepository),
    refreshTokens: testApp.app.get(RefreshTokensRepository),
    verificationTokens: testApp.app.get(VerificationTokensRepository),
  };
}

describeRefreshTokensRepositoryContract(createRepositories);
describeVerificationTokensRepositoryContract(createRepositories);
