import type { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REDIS_CLIENT } from '../../src/infra/redis/redis.module.js';
import { SessionsService } from '../../src/modules/sessions/sessions.service.js';
import { UsersService } from '../../src/modules/users/users.service.js';
import { createTestApp, type TestApp } from '../support/app.js';

const ACCESS_TOKEN_TTL_MS = 15 * 60_000;

describe('session revocation', () => {
  let testApp: TestApp;
  let sessionsService: SessionsService;

  beforeAll(async () => {
    testApp = await createTestApp({ ACCESS_TOKEN_TTL: '15m' });
    sessionsService = testApp.app.get(SessionsService);
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.reset();
  });

  it('deny-lists a revoked session in Redis for the access token lifetime', async () => {
    const user = await testApp.app
      .get(UsersService)
      .createUser({ email: 'ada@example.com', password: 'correct horse', name: 'Ada' });
    const session = await sessionsService.create({ userId: user.id, userAgent: null, ip: null });
    expect(await sessionsService.isRevoked(session.id)).toBe(false);

    await sessionsService.revoke(session.id);

    const ttlMs = await testApp.app
      .get<Redis>(REDIS_CLIENT)
      .pttl(`auth:revoked-session:${session.id}`);
    expect(ttlMs).toBeGreaterThan(ACCESS_TOKEN_TTL_MS - 60_000);
    expect(ttlMs).toBeLessThanOrEqual(ACCESS_TOKEN_TTL_MS);
    expect(await sessionsService.isRevoked(session.id)).toBe(true);
  });
});
