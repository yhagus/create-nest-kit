import type { AuthRepositories } from '../contracts/auth-repositories.js';
import { describeRefreshTokensRepositoryContract } from '../contracts/refresh-tokens-repository.contract.js';
import { describeVerificationTokensRepositoryContract } from '../contracts/verification-tokens-repository.contract.js';
import { createInMemoryRepositories } from './in-memory-repositories.js';
import { InMemoryRefreshTokensRepository } from './in-memory-refresh-tokens.repository.js';
import { InMemoryVerificationTokensRepository } from './in-memory-verification-tokens.repository.js';

// The fakes the unit tests use must behave like the real repositories.
async function createRepositories(): Promise<AuthRepositories> {
  const { store, users, sessions } = createInMemoryRepositories();
  return {
    users,
    sessions,
    refreshTokens: new InMemoryRefreshTokensRepository(store),
    verificationTokens: new InMemoryVerificationTokensRepository(store),
  };
}

describeRefreshTokensRepositoryContract(createRepositories);
describeVerificationTokensRepositoryContract(createRepositories);
