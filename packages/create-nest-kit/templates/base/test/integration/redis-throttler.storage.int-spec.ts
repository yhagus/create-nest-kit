import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { RedisThrottlerStorage } from '../../src/infra/throttler/redis-throttler.storage.js';

const TTL_MS = 60_000;
const LIMIT = 2;
const BLOCK_MS = 300;
const THROTTLER = 'default';

describe('RedisThrottlerStorage', () => {
  let redis: Redis;
  let storage: RedisThrottlerStorage;

  beforeAll(() => {
    redis = new Redis(inject('containerEnv').REDIS_URL);
    storage = new RedisThrottlerStorage(redis);
  });

  afterAll(async () => {
    await redis.quit();
  });

  const hit = (key: string) => storage.increment(key, TTL_MS, LIMIT, BLOCK_MS, THROTTLER);

  it('counts hits within the window', async () => {
    const key = randomUUID();

    await hit(key);
    const record = await hit(key);

    expect(record).toEqual({
      totalHits: 2,
      timeToExpire: TTL_MS / 1000,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('blocks a key once it goes over the limit', async () => {
    const key = randomUUID();

    await hit(key);
    await hit(key);
    const record = await hit(key);

    expect(record).toMatchObject({ isBlocked: true, timeToBlockExpire: 1 });
  });

  it('counts from zero again once the block ends', async () => {
    const key = randomUUID();
    await hit(key);
    await hit(key);
    await hit(key);

    await sleep(BLOCK_MS + 50);
    const record = await hit(key);

    expect(record).toMatchObject({ totalHits: 1, isBlocked: false });
  });

  it('keeps separate counts per key', async () => {
    const key = randomUUID();
    await hit(key);
    await hit(key);

    const record = await hit(randomUUID());

    expect(record.totalHits).toBe(1);
  });
});
