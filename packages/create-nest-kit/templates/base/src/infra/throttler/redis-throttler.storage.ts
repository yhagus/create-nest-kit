import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';

/** What ThrottlerGuard expects back from `increment()` (not exported by `@nestjs/throttler`). Times are in seconds. */
export interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Counts hits in a fixed window and, past the limit, blocks the key for `blockDuration`.
 * One script call per request, so concurrent requests from many instances can't race.
 * Returns { totalHits, hitsTtlMs, isBlocked (0|1), blockTtlMs }.
 */
const INCREMENT_SCRIPT = `
local hitsKey, blockKey = KEYS[1], KEYS[2]
local ttl, limit, blockDuration = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  return { tonumber(redis.call('GET', blockKey)), blockTtl, 1, blockTtl }
end

local hits = redis.call('INCR', hitsKey)
if hits == 1 then
  redis.call('PEXPIRE', hitsKey, ttl)
end
local hitsTtl = redis.call('PTTL', hitsKey)
if hits <= limit then
  return { hits, hitsTtl, 0, 0 }
end
if blockDuration <= 0 then
  return { hits, hitsTtl, 1, hitsTtl }
end

-- Counting starts over once the block ends.
redis.call('DEL', hitsKey)
redis.call('SET', blockKey, hits, 'PX', blockDuration)
return { hits, blockDuration, 1, blockDuration }
`;

const KEY_PREFIX = 'throttler';
const MILLISECONDS_PER_SECOND = 1000;

/** Keeps rate-limit counters in Redis, so limits hold across every instance of the API. */
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}

  /** `ttl` and `blockDuration` are in milliseconds. `key` already includes the throttler name. */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    // The hash tag ({...}) keeps both keys in one Redis Cluster slot, as a script requires.
    const result = await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      `${KEY_PREFIX}:{${key}}:hits`,
      `${KEY_PREFIX}:{${key}}:blocked`,
      ttl,
      limit,
      blockDuration,
    );
    if (!isScriptResult(result)) {
      throw new Error(`Unexpected throttler script result: ${JSON.stringify(result)}`);
    }
    const [totalHits, hitsTtlMs, isBlocked, blockTtlMs] = result;
    return {
      totalHits,
      timeToExpire: toSeconds(hitsTtlMs),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: toSeconds(blockTtlMs),
    };
  }
}

function isScriptResult(value: unknown): value is [number, number, number, number] {
  return (
    Array.isArray(value) && value.length === 4 && value.every((item) => typeof item === 'number')
  );
}

function toSeconds(milliseconds: number): number {
  return Math.ceil(milliseconds / MILLISECONDS_PER_SECOND);
}
