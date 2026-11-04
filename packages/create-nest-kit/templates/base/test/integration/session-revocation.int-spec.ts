import type { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REDIS_CLIENT } from '../../src/infra/redis/redis.module.js';
import { createTestApp, type TestApp } from '../support/app.js';
import {
  createSignedInUser,
  currentSessionId,
  expectAccessTokenRefused,
  seedSystemRoles,
} from '../support/auth.js';
import { request } from '../support/http.js';

const ACCESS_TOKEN_TTL_MS = 15 * 60_000;

describe('session revocation', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ ACCESS_TOKEN_TTL: '15m' });
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
    await seedSystemRoles(testApp);
  });

  it('deny-lists a revoked session in Redis for the access token lifetime', async () => {
    const { accessToken } = await createSignedInUser(testApp);
    const sessionId = await currentSessionId(testApp, accessToken);

    const response = await request(testApp, 'POST /auth/logout', { accessToken });

    expect(response.status).toBe(204);
    const ttlMs = await testApp.app
      .get<Redis>(REDIS_CLIENT)
      .pttl(`auth:revoked-session:${sessionId}`);
    expect(ttlMs).toBeGreaterThan(ACCESS_TOKEN_TTL_MS - 60_000);
    expect(ttlMs).toBeLessThanOrEqual(ACCESS_TOKEN_TTL_MS);
    await expectAccessTokenRefused(testApp, accessToken);
  });
});
