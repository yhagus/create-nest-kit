import { afterAll, beforeAll } from 'vitest';
import { RefreshTokenFamilies } from '../../src/auth/refresh-token-families.js';
import { PrismaAuthenticationStore } from '../../src/database/repositories/prisma-authentication.store.js';
import { SessionsRepository } from '../../src/modules/sessions/sessions.repository.js';
import { UsersRepository } from '../../src/modules/users/users.repository.js';
import {
  type AuthenticationStores,
  describeAuthenticationStoresContract,
} from '../contracts/authentication-stores.contract.js';
import { createTestApp, type TestApp } from '../support/app.js';

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp();
});

afterAll(async () => {
  await testApp.close();
});

// The store runs on the app's connection pool, so the concurrency cases really race.
async function createStores(): Promise<AuthenticationStores> {
  await testApp.reset();
  const store = testApp.app.get(PrismaAuthenticationStore);
  return {
    users: testApp.app.get(UsersRepository),
    sessions: testApp.app.get(SessionsRepository),
    sources: { refreshTokens: store, emailTokens: store, sessions: store },
    families: testApp.app.get(RefreshTokenFamilies),
    purger: store,
  };
}

describeAuthenticationStoresContract(createStores);
